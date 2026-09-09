#!/usr/bin/env bash
set -euo pipefail

docker compose --env-file .env -f ./docker-compose.yml up -d --build --wait database worker
docker compose --env-file .env -f ./docker-compose.yml --profile seed run --rm --build seeder
