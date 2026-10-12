#!/usr/bin/env bash
# Local end-to-end stack: Postgres (already running) + GoTrue + PostgREST +
# a one-origin proxy at http://localhost:54321, with the repo migrations
# applied. Lets the real app run every role flow without touching the live
# project.
#
#   e2e/stack.sh up      # download binaries (first run), rebuild DB, start services
#   e2e/stack.sh down
#   source e2e/.env.e2e  # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SERVICE_KEY
#
# Needs: psql access (PGHOST/PGPORT/PGUSER, default /tmp:55432 postgres), bun, node.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; root="$here/.."
WORK="${E2E_WORK:-/var/tmp/e2e}"; BIN="$WORK/bin"; mkdir -p "$BIN" "$WORK/logs"
PGHOST="${PGHOST:-/tmp}"; PGPORT="${PGPORT:-55432}"; PGUSER="${PGUSER:-postgres}"
DB=impulsa_e2e
SECRET="${E2E_JWT_SECRET:-e2e-local-jwt-secret-at-least-32-characters-long}"
P=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -q -v ON_ERROR_STOP=1)

down() { for n in proxy gotrue postgrest; do [ -f "$WORK/$n.pid" ] && kill "$(cat "$WORK/$n.pid")" 2>/dev/null || true; rm -f "$WORK/$n.pid"; done; }

if [ "${1:-up}" = down ]; then down; echo "stopped"; exit 0; fi
down

[ -x "$BIN/postgrest" ] || (cd "$BIN" && curl -sSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar -xJ)
[ -x "$BIN/auth" ] || (cd "$BIN" && curl -sSL https://github.com/supabase/auth/releases/download/v2.180.0/auth-v2.180.0-x86.tar.gz | tar -xz)

# Fresh database: roles, GoTrue's auth schema, then the app migrations.
"${P[@]}" -d postgres <<SQL
select pg_terminate_backend(pid) from pg_stat_activity where datname = '$DB';
drop database if exists $DB;
create database $DB;
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin login superuser password 'authpass'; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login noinherit password 'authpass'; end if;
end \$\$;
grant anon, authenticated, service_role to authenticator;
alter role supabase_auth_admin set search_path = auth;
SQL
"${P[@]}" -d "$DB" -c "create schema auth authorization supabase_auth_admin"
AUTH_ENV=(GOTRUE_DB_DRIVER=postgres DB_NAMESPACE=auth
  "DATABASE_URL=postgres://supabase_auth_admin:authpass@127.0.0.1:$PGPORT/$DB?sslmode=disable"
  "GOTRUE_JWT_SECRET=$SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated
  GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
  API_EXTERNAL_URL=http://localhost:54321/auth/v1 GOTRUE_SITE_URL=http://localhost:3000
  GOTRUE_URI_ALLOW_LIST='http://localhost:3000/**' GOTRUE_API_HOST=127.0.0.1 PORT=54332
  GOTRUE_DISABLE_SIGNUP=false GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true
  GOTRUE_SMTP_ADMIN_EMAIL=e2e@localhost GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 GOTRUE_LOG_LEVEL=warn)
(cd "$BIN" && env "${AUTH_ENV[@]}" ./auth migrate >"$WORK/logs/gotrue-migrate.log" 2>&1)
IMPULSA_DB=$DB KEEP_DB=1 "$root/supabase/tests/apply_all.sh" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >"$WORK/logs/migrations.log" 2>&1
# auth.uid() from the test stubs reads request.jwt.claims (what PostgREST 12 sets).

cat > "$WORK/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:authpass@127.0.0.1:$PGPORT/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-host = "127.0.0.1"
server-port = 54331
CONF
# (fully detached: no inherited stdout, so callers piping this script don't hang)
(cd "$BIN" && exec env "${AUTH_ENV[@]}" ./auth serve) >"$WORK/logs/gotrue.log" 2>&1 </dev/null & echo $! >"$WORK/gotrue.pid"
nohup "$BIN/postgrest" "$WORK/postgrest.conf" >"$WORK/logs/postgrest.log" 2>&1 </dev/null & echo $! >"$WORK/postgrest.pid"
nohup bun "$here/proxy.ts" >"$WORK/logs/proxy.log" 2>&1 </dev/null & echo $! >"$WORK/proxy.pid"

ANON=$(node "$here/jwt.mjs" "$SECRET" anon); SERVICE=$(node "$here/jwt.mjs" "$SECRET" service_role)
umask 077
cat > "$here/.env.e2e" <<ENV
export VITE_SUPABASE_URL=http://localhost:54321
export VITE_SUPABASE_ANON_KEY=$ANON
export E2E_SERVICE_KEY=$SERVICE
export E2E_PSQL="psql -h $PGHOST -p $PGPORT -U $PGUSER -d $DB"
ENV
for i in $(seq 1 30); do
  curl -sf http://localhost:54321/auth/v1/health >/dev/null && curl -sf -H "apikey: $ANON" http://localhost:54321/rest/v1/ >/dev/null && { echo "e2e stack up on http://localhost:54321"; exit 0; }
  sleep 1
done
echo "stack did not come up — see $WORK/logs"; exit 1
