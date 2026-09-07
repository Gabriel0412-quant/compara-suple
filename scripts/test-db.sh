#!/usr/bin/env bash
set -euo pipefail

: "${PGDATABASE:?Defina PGDATABASE para um banco de testes isolado com as migrations aplicadas.}"
case "$PGDATABASE" in
  *_test|test_*) ;;
  *) echo 'PGDATABASE deve identificar um banco de testes isolado (*_test ou test_*).' >&2; exit 1 ;;
esac

for test_file in supabase/tests/*.sql; do
  psql -X -v ON_ERROR_STOP=1 -f "$test_file"
done
