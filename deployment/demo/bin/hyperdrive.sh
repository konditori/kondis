#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
action="${1:-}"
identifier="${2:-}"

required=(CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID KONDIS_HYPERDRIVE_NAME)
if [[ "$action" == "ensure" || "$action" == "update" ]]; then
  required+=(
    KONDIS_DB_TUNNEL_HOSTNAME
    KONDIS_DB_DATABASE_NAME
    KONDIS_DB_RUNTIME_USERNAME
    KONDIS_DB_RUNTIME_PASSWORD
    KONDIS_HYPERDRIVE_ACCESS_CLIENT_ID
    KONDIS_HYPERDRIVE_ACCESS_CLIENT_SECRET
    KONDIS_HYPERDRIVE_CA_CERTIFICATE_ID
  )
fi
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "${name} must be set" >&2
    exit 2
  fi
done
if [[ "$action" == "ensure" || "$action" == "update" ]]; then
  if [[ ! "$KONDIS_HYPERDRIVE_CA_CERTIFICATE_ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
    echo "KONDIS_HYPERDRIVE_CA_CERTIFICATE_ID must be a UUID without whitespace" >&2
    exit 2
  fi
fi

wrangler=(pnpm --dir "$repo_root/server" exec wrangler)

find_by_name() {
  local page=1
  local total_pages=1
  local response
  local matches=()
  local match

  while (( page <= total_pages )); do
    response="$(curl --fail --silent --show-error --get \
      --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      --data-urlencode "page=$page" \
      --data-urlencode "per_page=100" \
      "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/hyperdrive/configs")"
    jq --exit-status '.success == true and (.result | type == "array")' <<<"$response" >/dev/null
    while IFS= read -r match; do
      matches+=("$match")
    done < <(jq --arg name "$KONDIS_HYPERDRIVE_NAME" -r '.result[] | select(.name == $name) | .id' <<<"$response")
    total_pages="$(jq -r '.result_info.total_pages // 1' <<<"$response")"
    page=$((page + 1))
  done

  if (( ${#matches[@]} > 1 )); then
    echo "Duplicate Hyperdrive configuration name: $KONDIS_HYPERDRIVE_NAME" >&2
    return 1
  fi
  printf '%s\n' "${matches[0]:-}"
}

name_for_id() {
  curl --fail --silent --show-error \
    --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/hyperdrive/configs/$1" |
    jq -er '.result.name'
}

upsert() {
  local id="$1"
  local connection_limit="${KONDIS_HYPERDRIVE_ORIGIN_CONNECTION_LIMIT:-5}"
  if [[ ! "$connection_limit" =~ ^[0-9]+$ || "$connection_limit" -lt 5 ]]; then
    echo "KONDIS_HYPERDRIVE_ORIGIN_CONNECTION_LIMIT must be at least 5" >&2
    exit 2
  fi
  local common=(
    --name "$KONDIS_HYPERDRIVE_NAME"
    --origin-host "$KONDIS_DB_TUNNEL_HOSTNAME"
    --database "$KONDIS_DB_DATABASE_NAME"
    --origin-user "$KONDIS_DB_RUNTIME_USERNAME"
    --origin-password "$KONDIS_DB_RUNTIME_PASSWORD"
    --access-client-id "$KONDIS_HYPERDRIVE_ACCESS_CLIENT_ID"
    --access-client-secret "$KONDIS_HYPERDRIVE_ACCESS_CLIENT_SECRET"
    --sslmode verify-ca
    --ca-certificate-id "$KONDIS_HYPERDRIVE_CA_CERTIFICATE_ID"
    --origin-connection-limit "$connection_limit"
    --caching-disabled
  )

  if [[ -n "$id" ]]; then
    "${wrangler[@]}" hyperdrive update "$id" "${common[@]}" >&2
    printf '%s\n' "$id"
    return
  fi

  local output
  output="$("${wrangler[@]}" hyperdrive create "$KONDIS_HYPERDRIVE_NAME" "${common[@]:2}")"
  printf '%s\n' "$output" >&2
  if [[ ! "$output" =~ ([0-9a-fA-F]{32}) ]]; then
    echo "Could not read the created Hyperdrive ID" >&2
    exit 1
  fi
  printf '%s\n' "${BASH_REMATCH[1]}"
}

case "$action" in
  ensure)
    upsert "$(find_by_name)"
    ;;
  update)
    if [[ ! "$identifier" =~ ^[0-9a-fA-F]{32}$ ]]; then
      echo "Usage: $0 update HYPERDRIVE_ID" >&2
      exit 2
    fi
    existing_name="$(name_for_id "$identifier")"
    if [[ "$existing_name" != "$KONDIS_HYPERDRIVE_NAME" ]]; then
      echo "Refusing to update Hyperdrive $identifier named $existing_name" >&2
      exit 1
    fi
    upsert "$identifier"
    ;;
  delete)
    id="$(find_by_name)"
    if [[ -n "$id" ]]; then
      "${wrangler[@]}" hyperdrive delete "$id"
    fi
    ;;
  *)
    echo "Usage: $0 {ensure|update HYPERDRIVE_ID|delete}" >&2
    exit 2
    ;;
esac
