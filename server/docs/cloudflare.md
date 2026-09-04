# Cloudflare Worker deployment

Phase 2 uses one cache-disabled Hyperdrive configuration per deployment
environment. The Hyperdrive ID is infrastructure state, not an application
secret, and is supplied to the deploy script rather than committed to the
repository.

Create the Hyperdrive configuration once, using a TLS connection to the PG 17
origin:

```sh
pnpm exec wrangler hyperdrive create kondis-staging \
  --connection-string="$KONDIS_CLOUD_DATABASE_URL" \
  --caching-disabled
```

Repeat for production. Store the returned IDs in the CI environment as
`KONDIS_HYPERDRIVE_ID_STAGING` and `KONDIS_HYPERDRIVE_ID_PRODUCTION`, then
deploy with the matching environment:

```sh
export CLOUDFLARE_ENV=staging
export KONDIS_HYPERDRIVE_ID="$KONDIS_HYPERDRIVE_ID_STAGING"
pnpm cloudflare:deploy
```

For the one-time compatibility probe, add its token to the generated
environment's Worker:

```sh
pnpm exec wrangler secret put HYPERDRIVE_SPIKE_TOKEN \
  --name kondis-api-staging
```

The deploy script generates an ignored, environment-specific Wrangler config
and invokes `wrangler deploy` with it. No database connection string is written
to that generated file. Migrations continue to run from CI or a Node process
using the direct database connection; they must not run through Hyperdrive.

For local Worker execution, provide a direct TLS connection string through
Wrangler's supported local binding variable:

```sh
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$KONDIS_CLOUD_DATABASE_URL"
pnpm exec wrangler dev --config wrangler.staging.generated.json
```

The guarded `GET /api/v1/_internal/hyperdrive-spike` endpoint verifies the
PostgreSQL version, auth-session lookup, permission query, PostGIS matching,
VectorChord nearest-neighbor search, a transaction, and `FOR UPDATE`. Supply
the endpoint's bearer token through the `HYPERDRIVE_SPIKE_TOKEN` Worker secret;
without both the binding and token it returns 404.
