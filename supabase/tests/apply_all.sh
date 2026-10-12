#!/usr/bin/env bash
# Rebuild a throwaway local database from the repo migrations, in the order the
# live project received them (004_rls_policies needs 012's uuid fix first;
# 002_seed is demo data and is never applied).
# Usage: supabase/tests/apply_all.sh [psql connection args...]
#   IMPULSA_DB=name   database to build (default impulsa_test)
#   KEEP_DB=1         apply into an existing database (e.g. one GoTrue already
#                     migrated for the end-to-end stack) instead of recreating it
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; mig="$here/../migrations"
PSQL=(psql "$@" -q -v ON_ERROR_STOP=1)
DB="${IMPULSA_DB:-impulsa_test}"
if [ "${KEEP_DB:-0}" != "1" ]; then
  "${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
fi
run() { "${PSQL[@]}" -d "$DB" -f "$1" >/dev/null || { echo "FAILED: $1" >&2; exit 1; }; }
run "$here/00_supabase_stubs.sql"
order=()
for f in $(ls "$mig"/*.sql | sort); do
  b=$(basename "$f")
  case "$b" in 002_seed.sql|004_rls_policies.sql) continue;; esac
  order+=("$f")
  if [[ "$b" == 012_* ]]; then order+=("$mig/004_rls_policies.sql"); fi
done
# 012 uses current_user_role() from 004_rls_policies; define it first (same body).
helper="$(mktemp)"; sed -n '/create or replace function public.current_user_role()/,/^\$\$;/p' "$mig/004_rls_policies.sql" > "$helper"
for f in "${order[@]}"; do
  [[ "$(basename "$f")" == 012_* ]] && run "$helper"
  run "$f"
done
rm -f "$helper"
echo "applied ${#order[@]} migration runs"
