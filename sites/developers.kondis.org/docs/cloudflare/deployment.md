---
title: Workers deployment
---

# Deploying on Cloudflare Workers

These instructions deploy the Kondis API to Cloudflare Workers. This deployment method is currently not finished and therefore only aimed at developers.

Run the commands below from `server/` in the Kondis repository.

Before deploying, select an [authentication mode](./authentication). Local bcrypt authentication requires Workers Paid due to execution time; small Workers Free deployments can instead use Cloudflare Access as their authoritative identity provider.

## Hyperdrive

Kondis uses one cache-disabled Hyperdrive configuration per deployment environment. The Hyperdrive ID is infrastructure state, not an application secret, and is supplied to the deploy script rather than committed to the repository.

Create the Hyperdrive configuration once using a TLS connection to the PostgreSQL 17 origin:

```sh
pnpm exec wrangler hyperdrive create kondis-staging \
  --connection-string="$KONDIS_CLOUD_DATABASE_URL" \
  --caching-disabled
```

Repeat this for production. Store the returned IDs in the CI environment as `KONDIS_HYPERDRIVE_ID_STAGING` and `KONDIS_HYPERDRIVE_ID_PRODUCTION`.

Migrations must run from CI or a Node.js process using the direct database connection. Do not run migrations through Hyperdrive. Use a least-privileged runtime database role for Hyperdrive and keep schema and DDL permissions on the separate migration credential.

## Deploy

Set the target environment and its Hyperdrive ID, then run the deployment script:

```sh
export CLOUDFLARE_ENV=staging
export KONDIS_HYPERDRIVE_ID="$KONDIS_HYPERDRIVE_ID_STAGING"
pnpm cloudflare:deploy
```

The script generates an ignored `wrangler-generated-<environment>.json` file and deploys with it. The generated file contains the Hyperdrive, Queue, dead-letter Queue, consumer, concurrency, retry, and Cron Trigger configuration. It does not contain the database connection string and must not be edited manually.

## Local Worker execution

For local Worker execution, provide a direct TLS connection string through Wrangler's supported local binding variable:

```sh
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$KONDIS_CLOUD_DATABASE_URL"
pnpm exec wrangler dev --config wrangler-generated-staging.json
```

Generate the configuration with `pnpm cloudflare:deploy` before using it locally. That command also deploys the Worker, so do not run it against an environment unless you intend to deploy there.

## Compatibility probe

The guarded `GET /api/v1/_internal/hyperdrive-spike` endpoint verifies the PostgreSQL version, auth-session lookup, permission query, PostGIS matching, VectorChord nearest-neighbor search, a transaction, and `FOR UPDATE` behavior.

For the one-time compatibility probe, add a bearer token to the generated environment's Worker:

```sh
pnpm exec wrangler secret put HYPERDRIVE_SPIKE_TOKEN \
  --name kondis-api-staging
```

Without both the Hyperdrive binding and `HYPERDRIVE_SPIKE_TOKEN`, the diagnostic endpoint returns `404`. Remove the secret after the compatibility check to disable the route again.

## Cloud job queues

Cloud API writes insert into `background_job` in the same transaction as the domain mutation. The one-minute dispatcher publishes unpublished rows to Cloudflare Queues.

Until the cloud Node processor and its R2-backed handlers are deployed, only Worker-owned schedules are enabled. Set `KONDIS_CLOUD_NODE_PROCESSOR_ENABLED=true` during deployment only after that processor is live. Enabling it earlier creates Node-owned jobs that no process can complete.

The Worker currently consumes the portable credential-cleanup job. Heavy jobs remain on the Node.js polling processor, which claims rows with `FOR UPDATE SKIP LOCKED`. Hyperdrive is only used for runtime queries; migrations continue to use the direct PostgreSQL connection.

The cloud Node processor is a separate long-running Node.js deployment. Build the server image or distribution, provide the same direct PostgreSQL environment used by the existing Node runtime, and start it with:

```sh
export KONDIS_CLOUD_NODE_PROCESSOR_ENABLED=true
pnpm build
pnpm start:cloud-node-processor
```

Keep that process healthy before deploying a Worker configuration with `KONDIS_CLOUD_NODE_PROCESSOR_ENABLED=true`. The Worker then exposes the admin `POST /api/v1/jobs` enqueue operation and enables the Node-owned schedules. Queue commands remain unavailable on the Worker because Cloudflare Queue administration is managed by deployment configuration.

For a guarded smoke check of the Worker-owned cleanup job, set `KONDIS_AUTH_CREDENTIAL_CLEANUP_TOKEN` as a Worker secret and call `POST /api/v1/_internal/auth-credential-cleanup` with its bearer token. Without the secret the endpoint is disabled and returns `404`.

Queue delivery and lease recovery are intentionally at-least-once. Job handlers must remain idempotent because a handler can finish an external side effect and lose its lease before recording completion. Application failures are persisted back to the transactional outbox and retried by the dispatcher. Cloudflare Queue retries are reserved for transport and runtime failures so the two retry systems cannot race each other.
