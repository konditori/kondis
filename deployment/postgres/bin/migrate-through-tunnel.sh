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

for _ in {1..60}; do
  if ! kill -0 "$proxy_pid" 2>/dev/null; then
    cat "$log_file" >&2
    exit 1
  fi

  if (echo >/dev/tcp/127.0.0.1/"$local_port") 2>/dev/null; then
    export KONDIS_DB_HOSTNAME=127.0.0.1
    export KONDIS_DB_PORT="$local_port"
    export KONDIS_DB_USERNAME="$KONDIS_DB_MIGRATOR_USERNAME"
    export KONDIS_DB_PASSWORD="$KONDIS_DB_MIGRATOR_PASSWORD"

    # The access-tcp process opens its local listener before it has completed
    # the WebSocket connection to the tunnel origin. Perform a real PostgreSQL
    # handshake before starting the migration, so migrations run only once.
    for _ in {1..60}; do
      if pnpm --filter kondis-server exec node -e '
        const { Client } = require("pg");
        const client = new Client({
          host: process.env.KONDIS_DB_HOSTNAME,
          port: Number(process.env.KONDIS_DB_PORT),
          user: process.env.KONDIS_DB_USERNAME,
          password: process.env.KONDIS_DB_PASSWORD,
          database: process.env.KONDIS_DB_DATABASE_NAME,
          connectionTimeoutMillis: 2000,
        });
        client.connect().then(() => client.end()).catch(async () => {
          await client.end().catch(() => {});
          process.exit(1);
        });
      ' >/dev/null 2>&1; then
        mise run //server:migrate
        exit 0
      fi

      sleep 1
    done

    echo "Timed out waiting for PostgreSQL through the Cloudflare Access tunnel" >&2
    cat "$log_file" >&2
    exit 1
  fi

  sleep 1
done

echo "Timed out waiting for the local Cloudflare Access TCP proxy" >&2
cat "$log_file" >&2
exit 1
