#!/usr/bin/env bash
set -euo pipefail

runtime_username="$(cat /run/secrets/runtime_username)"
runtime_password="$(cat /run/secrets/runtime_password)"
migrator_username="$POSTGRES_USER"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set database_name="$POSTGRES_DB" \
  --set migrator_username="$migrator_username" \
  --set runtime_username="$runtime_username" \
  --set runtime_password="$runtime_password" <<'SQL'
SELECT CASE
  WHEN EXISTS (SELECT FROM pg_roles WHERE rolname = :'runtime_username')
    THEN format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'runtime_username', :'runtime_password')
  ELSE format('CREATE ROLE %I LOGIN PASSWORD %L', :'runtime_username', :'runtime_password')
END;
\gexec

GRANT CONNECT ON DATABASE :"database_name" TO :"runtime_username";
GRANT USAGE ON SCHEMA public TO :"runtime_username";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"runtime_username";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO :"runtime_username";

ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_username" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"runtime_username";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_username" IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO :"runtime_username";
SQL
