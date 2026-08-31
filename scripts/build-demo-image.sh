#!/usr/bin/env bash

set -Eeuo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# Cloudflare runs AMD64; override this with linux/arm64 for a native Apple Silicon test build.
docker build \
  --platform "${KONDIS_DEMO_PLATFORM:-linux/amd64}" \
  --file "$repo_root/docker/Dockerfile.demo" \
  --tag "${KONDIS_DEMO_IMAGE:-kondis-demo:latest}" \
  "$@" \
  "$repo_root"
