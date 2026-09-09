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
    "${compose[@]}" --profile ops run --rm --build migrations
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
