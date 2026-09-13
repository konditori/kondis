#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

compose=(docker compose --env-file .env -f docker-compose.yml)
command="${1:-up}"

case "$command" in
  up)
    "${compose[@]}" up -d --build database
    ;;
  migrate)
    echo "Migrations are run outside this 1 GB database host." >&2
    echo "Use 'mise run postgres:migrate' from GitHub Actions or a development machine." >&2
    exit 2
    ;;
  logs)
    "${compose[@]}" logs -f database
    ;;
  ps)
    "${compose[@]}" ps
    ;;
  down)
    "${compose[@]}" down
    ;;
  *)
    echo "Usage: $0 {up|migrate|logs|ps|down}" >&2
    exit 2
    ;;
esac
