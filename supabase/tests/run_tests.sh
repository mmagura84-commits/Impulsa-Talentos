#!/usr/bin/env bash
# Rebuild a throwaway database from all migrations and run the role tests.
# Usage: supabase/tests/run_tests.sh [psql connection args...]
#   e.g. supabase/tests/run_tests.sh -h localhost -p 5432 -U postgres
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
"$here/apply_all.sh" "$@"
out="$(psql "$@" -d impulsa_test -X -q -f "$here/10_role_permissions.sql" 2>&1)"
echo "$out" | grep -E "^(──|psql:.*(PASS|FAIL)|NOTICE:  (PASS|FAIL))|ERROR" | sed -E 's/^psql:[^ ]+ NOTICE:  /  /; s/^NOTICE:  /  /'
pass=$(grep -c "PASS " <<<"$out" || true); fail=$(grep -c "FAIL " <<<"$out" || true)
echo "passed: $pass  failed: $fail"
[[ "$fail" == "0" ]] && ! grep -q "ERROR" <<<"$out"
