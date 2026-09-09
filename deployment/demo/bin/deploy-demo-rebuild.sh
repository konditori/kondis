#!/usr/bin/env bash
set -euo pipefail

mise run //:deploy:demo
echo "Demo Workers deployed. Rebuilding the demo database now."
bash ./bin/demo-db-rebuild.sh
docker compose --env-file .env -f ./docker-compose.yml ps