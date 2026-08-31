#!/usr/bin/env bash

set -Eeuo pipefail

export POSTGRES_USER="${POSTGRES_USER:-$DB_USERNAME}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$DB_PASSWORD}"
export POSTGRES_DB="${POSTGRES_DB:-$DB_DATABASE_NAME}"

mkdir -p "$PGDATA" "$KONDIS_STORAGE_DIR"

postgres_pid=''
server_pid=''

shutdown() {
  [[ -z "$server_pid" ]] || kill -TERM "$server_pid" 2>/dev/null || true
  [[ -z "$postgres_pid" ]] || kill -TERM "$postgres_pid" 2>/dev/null || true
  [[ -z "$server_pid" ]] || wait "$server_pid" 2>/dev/null || true
  [[ -z "$postgres_pid" ]] || wait "$postgres_pid" 2>/dev/null || true
}

terminate() {
  trap - TERM INT EXIT
  shutdown
  exit 0
}

trap terminate TERM INT
trap shutdown EXIT

/usr/local/bin/docker-entrypoint.sh postgres \
  -c listen_addresses=127.0.0.1 \
  -c shared_preload_libraries=vchord.so &
postgres_pid=$!

until pg_isready --host 127.0.0.1 --port "$DB_PORT" --username "$DB_USERNAME" --dbname "$DB_DATABASE_NAME" >/dev/null 2>&1; do
  if ! kill -0 "$postgres_pid" 2>/dev/null; then
    wait "$postgres_pid"
    exit $?
  fi
  sleep 0.2
done

node dist/main.js &
server_pid=$!

set +e
wait -n "$postgres_pid" "$server_pid"
status=$?
set -e

exit "$status"
