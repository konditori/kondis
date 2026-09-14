#!/usr/bin/env bash
set -euo pipefail

if [[ ! "${1:-}" =~ ^[1-9][0-9]*$ ]]; then
  echo "Usage: $0 PR_NUMBER" >&2
  exit 2
fi

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN must be set}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID must be set}"

delete_worker() {
  local name="$1"
  local status
  status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --request DELETE \
    --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$name")"
  case "$status" in
    200|204)
      echo "Deleted Worker: $name"
      ;;
    404)
      echo "Worker already absent: $name"
      ;;
    *)
      echo "Could not delete Worker $name: HTTP $status" >&2
      return 1
      ;;
  esac
}

failed=0
delete_worker "kondis-demo-web-pr-$1" || failed=1
delete_worker "kondis-demo-api-pr-$1" || failed=1
exit "$failed"
