---
title: Workers deployment
---

# Deploying on Cloudflare Workers

These instructions deploy the Kondis API and web Workers to Cloudflare. Node-owned processing, R2, Queues, and Durable Objects are selected explicitly by the generated deployment configuration.

Run the commands below from the repository root. The deployment task is defined in the root `mise.toml` and uses the pinned Node.js and pnpm versions from mise.

Before deploying, select an [authentication mode](./authentication). Local bcrypt authentication requires Workers Paid due to execution time; small Workers Free deployments can instead use Cloudflare Access as their authoritative identity provider.

## Hyperdrive

Kondis uses one cache-disabled Hyperdrive configuration per deployment environment. The Hyperdrive ID is infrastructure state, not an application secret, and is supplied to the deployment task rather than committed to the repository. Hyperdrive and Cloudflare Access are infrastructure concerns; the Worker deployment task does not create or modify them.

Create the Hyperdrive configuration once per environment using a TLS connection to the PostgreSQL 17 origin. Prefer Terraform when the environment is managed there. For a one-off Wrangler setup:

Hyperdrive requires TLS even when the origin is reached through Cloudflare Tunnel. The repository's local PostgreSQL image enables SSL and generates a development certificate on startup; rebuild the database container with `mise dev-update` after changing the image. A production or separately managed origin must provide its own TLS certificate.

```sh
mise exec -- pnpm --dir server exec wrangler hyperdrive create kondis-worker-test-postgres \
  --connection-string="$KONDIS_CLOUD_DATABASE_URL" \
  --caching-disabled
```

Use a name matching the deployment environment, such as `kondis-staging-postgres` or `kondis-production-postgres`. Store the returned ID in the deployment environment as `KONDIS_HYPERDRIVE_ID`.

Migrations must run from CI or a Node.js process using the direct database connection. Do not run migrations through Hyperdrive. Use a least-privileged runtime database role for Hyperdrive and keep schema and DDL permissions on the separate migration credential.

Run pending migrations before deploying Worker code. The migration command reads the direct PostgreSQL connection from `KONDIS_DB_HOSTNAME`, `KONDIS_DB_PORT`, `KONDIS_DB_USERNAME`, `KONDIS_DB_PASSWORD`, and `KONDIS_DB_DATABASE_NAME`:

```sh
mise //server:migrate
```

For the queue split deployment, this applies `1789000000000-SplitActivityQueues`, including the `background_job.dispatch_token` column required by the Worker dispatcher. A successful upload can still be followed by a dispatcher failure if this migration has not been applied.

## Deploy

### Public demo

The public demo is an anonymous, read-only deployment. It serves the single
provisioned database user and caches successful API and rendered-page reads for
one day. It does not put a credential in the browser. `KONDIS_DEMO_MODE=true` is
read by the server config repository and makes the API reject every non-read
request. Demo config generation omits R2, Queues, queue executors, and Durable
Objects because the demo does not accept uploads or edits. The first demo request
provisions the demo user and its fictional FIT activity history automatically; it
still aborts if the database contains more than one user.

Provide the environment-specific Hyperdrive ID:

```sh
KONDIS_HYPERDRIVE_ID="$KONDIS_PRODUCTION_HYPERDRIVE_ID" \
mise run deploy:demo production
```

Use `preview` with the preview database for preview traffic:

```sh
KONDIS_HYPERDRIVE_ID="$KONDIS_PREVIEW_HYPERDRIVE_ID" \
mise run deploy:demo preview
```

Use `--dry-run` to inspect the generated configs. In GitHub Actions, store the
Hyperdrive ID in the matching GitHub Environment's secrets. The deployment script
sets `KONDIS_DEMO_MODE=true` and `KONDIS_CLOUD_NODE_PROCESSOR_ENABLED=false` for
you.

The demo's source and generated Wrangler configurations live under
`deployment/demo/`; no demo configuration is written into `server/` or `web/`.

For `production`, the command deploys `kondis-public-demo-api-production` and
`kondis-public-demo-web-production`, attaching the web Worker to the public
custom domain `demo.kondis.org`. The `preview` command creates matching,
isolated `-preview` Workers without claiming the production domain. Both API
Workers use only Hyperdrive for persistence.

### General Worker deployment

Set the target environment and its Hyperdrive ID, then run the root deployment task:

```sh
export KONDIS_HYPERDRIVE_ID="$KONDIS_HYPERDRIVE_ID_WORKER_TEST"
mise run deploy:cloudflare worker-test
```

The deployment task performs these steps in order:

1. Generates ignored API and web Wrangler configs:
   `server/wrangler-generated-<environment>.json` and
   `web/wrangler-generated-<environment>.json`.
2. Names the Workers `kondis-api-<environment>` and `kondis-web-<environment>`, and binds the web Worker to the matching API Worker.
3. Creates the environment's R2 bucket and Queues, including dead-letter Queues. Existing resources are accepted as successful, so the task is safe to rerun.
4. Deploys the API Worker first.
5. Builds and deploys the web Worker second.

The generated API config contains the Hyperdrive binding, R2 bucket, Queue producers and consumers, dead-letter Queues, concurrency, retry, and Cron Trigger configuration. It does not contain the database connection string and must not be edited manually.

For example, environment `worker-test` creates or reuses:

```sh
kondis-api-worker-test
kondis-web-worker-test
kondis-api-worker-test-storage
kondis-api-worker-test-activity-parsing
kondis-api-worker-test-activity-parsing-dlq
kondis-api-worker-test-activity-enrichment
kondis-api-worker-test-activity-enrichment-dlq
```

The remaining background, image-processing, and storage Queues follow the same `kondis-api-worker-test-*` naming pattern.

Use a dry run to generate and inspect both configs without provisioning resources, building, or deploying:

```sh
mise run deploy:cloudflare worker-test --dry-run
```

## Local Worker execution

For local Worker execution, provide a direct TLS connection string through Wrangler's supported local binding variable:

```sh
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$KONDIS_CLOUD_DATABASE_URL"
mise exec -- pnpm --dir server exec wrangler dev --config wrangler-generated-staging.json
```

Generate the configuration with `mise run deploy:cloudflare staging --dry-run` before using it locally. The generated file is written under `server/`; the dry run does not deploy anything.

## Compatibility probe

The guarded `GET /api/v1/_internal/hyperdrive-spike` endpoint verifies the PostgreSQL version, auth-session lookup, permission query, PostGIS matching, VectorChord nearest-neighbor search, a transaction, and `FOR UPDATE` behavior.

For the one-time compatibility probe, add a bearer token to the generated environment's Worker:

```sh
mise exec -- pnpm --dir server exec wrangler secret put HYPERDRIVE_SPIKE_TOKEN \
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
mise exec -- pnpm --dir server run build
mise exec -- pnpm --dir server run start:cloud-node-processor
```

Keep that process healthy before deploying a Worker configuration with `KONDIS_CLOUD_NODE_PROCESSOR_ENABLED=true`. The Worker then exposes the admin `POST /api/v1/jobs` enqueue operation and enables the Node-owned schedules. Queue commands remain unavailable on the Worker because Cloudflare Queue administration is managed by deployment configuration.

For a guarded smoke check of the Worker-owned cleanup job, set `KONDIS_AUTH_CREDENTIAL_CLEANUP_TOKEN` as a Worker secret and call `POST /api/v1/_internal/auth-credential-cleanup` with its bearer token. Without the secret the endpoint is disabled and returns `404`.

When the `REALTIME` Durable Object binding is present, the Worker validates event tickets before forwarding `/events` WebSocket upgrades. The Durable Object owns connections and receives best-effort event publications from API and Queue invocations. Its migration is generated with the Worker config; do not mount event-ticket routes in a deployment that omits the binding.

Multipart uploads are buffered by the Worker and checked against the application limits before staging their bytes in R2. Cloudflare request-size limits can be lower than the 256 MiB Strava takeout limit, depending on the plan. Large archives should use a direct or multipart R2 upload flow and then enqueue a processing job; increasing the multipart endpoint limit cannot bypass the platform request limit.

Queue delivery and lease recovery are intentionally at-least-once. Job handlers must remain idempotent because a handler can finish an external side effect and lose its lease before recording completion. Application failures are persisted back to the transactional outbox and retried by the dispatcher. Cloudflare Queue retries are reserved for transport and runtime failures so the two retry systems cannot race each other.
