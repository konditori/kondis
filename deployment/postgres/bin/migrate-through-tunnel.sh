#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$repo_root"

required=(
  KONDIS_DB_TUNNEL_HOSTNAME
  KONDIS_DB_TUNNEL_CLIENT_ID
  KONDIS_DB_TUNNEL_CLIENT_SECRET
  KONDIS_DB_MIGRATOR_USERNAME
  KONDIS_DB_MIGRATOR_PASSWORD
  KONDIS_DB_DATABASE_NAME
)

for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "${name} must be set" >&2
    exit 2
  fi
done

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is required; install it before running this command" >&2
  exit 2
fi

local_port="${KONDIS_DB_TUNNEL_LOCAL_PORT:-15432}"
log_file="$(mktemp)"

cleanup() {
  if [[ -n "${proxy_pid:-}" ]] && kill -0 "$proxy_pid" 2>/dev/null; then
    kill "$proxy_pid" 2>/dev/null || true
    wait "$proxy_pid" 2>/dev/null || true
  fi
  rm -f "$log_file"
}
trap cleanup EXIT INT TERM

cloudflared access tcp \
  --hostname "$KONDIS_DB_TUNNEL_HOSTNAME" \
  --url "127.0.0.1:${local_port}" \
  --service-token-id "$KONDIS_DB_TUNNEL_CLIENT_ID" \
  --service-token-secret "$KONDIS_DB_TUNNEL_CLIENT_SECRET" \
  >"$log_file" 2>&1 &
proxy_pid=$!

listener_ready=false
for _ in {1..30}; do
  if ! kill -0 "$proxy_pid" 2>/dev/null; then
    cat "$log_file" >&2
    exit 1
  fi

  if grep -q "Start Websocket listener" "$log_file"; then
    listener_ready=true
    break
  fi

  sleep 0.2
done

if [[ "$listener_ready" != true ]]; then
  echo "Timed out waiting for the local Cloudflare Access TCP listener" >&2
  cat "$log_file" >&2
  exit 1
fi

export KONDIS_DB_HOSTNAME=127.0.0.1
export KONDIS_DB_PORT="$local_port"
export KONDIS_DB_USERNAME="$KONDIS_DB_MIGRATOR_USERNAME"
export KONDIS_DB_PASSWORD="$KONDIS_DB_MIGRATOR_PASSWORD"

if ! mise run //server:migrate; then
  cat "$log_file" >&2
  exit 1
fi
