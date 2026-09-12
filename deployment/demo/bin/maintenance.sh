#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
wrangler=(pnpm --dir "$repo_root/server" exec wrangler)

case "${1:-}" in
  enable)
    maintenance_enabled_at="$(( $(date +%s) * 1000 ))"
    maintenance_session="${maintenance_enabled_at}-${RANDOM}"
    "${wrangler[@]}" deploy --config "$repo_root/deployment/demo/wrangler-maintenance.jsonc" \
      --var "MAINTENANCE_SESSION:${maintenance_session}" \
      --var "MAINTENANCE_ENABLED_AT:${maintenance_enabled_at}"
    ;;
  *)
    echo "Usage: $0 enable" >&2
    exit 2
    ;;
esac
