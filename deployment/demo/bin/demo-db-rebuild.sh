#!/usr/bin/env bash
set -euo pipefail

docker compose --env-file .env -f ./docker-compose.yml up -d --build --wait database worker
docker compose --env-file .env -f ./docker-compose.yml exec -T database /bin/bash -s <<'BASH'
set -euo pipefail
db_name="$POSTGRES_DB"
db_user="$(cat /run/secrets/demo_db_username)"
db_password="$(cat /run/secrets/demo_db_password)"
PGPASSWORD="$db_password" psql --dbname=postgres --username="$db_user" -v ON_ERROR_STOP=1 -v db_name="$db_name" -v owner_name="$db_user" <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = :'db_name' AND pid <> pg_backend_pid();
SELECT format('DROP DATABASE IF EXISTS %I', :'db_name') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'owner_name') \gexec
SQL
BASH
docker compose --env-file .env -f ./docker-compose.yml --profile seed run --rm --build seeder
