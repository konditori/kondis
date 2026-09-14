---
title: Cloudflare deployment
---

# Deploying on Cloudflare

Kondis supports deploying most of the application to Cloudflare, although some features, such as image processing, are not yet available in this environment. Cloudflare does not currently provide a PostgreSQL service with extensions required by Kondis, such as VectorChord. You must therefore run PostgreSQL elsewhere, for example on a VPS, connect it through Hyperdrive, and deploy the remaining Kondis services to Cloudflare. Cloudflare Containers could provide another option, but this approach is currently untested and may be expensive.

In this deployment mode, job queues are handled by Cloudflare Queues instead of pg-boss. R2 object storage replaces filesystem access, and the frontend and API run as Cloudflare Workers.

The bcrypt password hashing method used by the standard deployment is not well suited to a serverless environment because it is intentionally slow. When deploying to Cloudflare Workers, you will likely need to disable this method and use Managed OAuth with Cloudflare Access instead.

The deployment is intended to work on Cloudflare's free tier, although you may encounter platform usage limits.

## Database server

You need to run PostgreSQL outside Cloudflare. The easiest option is to clone the Kondis repository and use its Docker Compose configuration to initialize the database. This requires significantly more CPU and memory than the database needs after deployment, however. For a smaller VPS, initialize the database there and run migrations from another machine through a Cloudflare Tunnel.

Regardless of where PostgreSQL runs, apply the Kondis migrations with:

```sh
mise //server:migrate
```

This connects to PostgreSQL and creates or updates the Kondis schema. Run it again whenever the database schema changes. Migrations use a direct PostgreSQL connection; they do not use Hyperdrive.

## Hyperdrive

The Cloudflare deployment uses Hyperdrive for runtime database connections. The deployment script does not create Hyperdrive or the Cloudflare Access application, so configure both before deploying the Workers.

Your PostgreSQL server must be reachable from Cloudflare through a public TCP hostname, normally a Cloudflare Tunnel protected by a Cloudflare Access application. That application must allow the Hyperdrive service token to authenticate. Use separate service tokens for migrations and Hyperdrive, and do not use the migration role for application traffic.

The database server must support TLS. A self-signed certificate is acceptable if you upload the public certificate as Hyperdrive's CA certificate and configure Hyperdrive with `sslmode=verify-ca`. Keep the certificate stable after creating Hyperdrive. The PostgreSQL setup in `deployment/postgres/README.md` documents the expected runtime role, tunnel, and certificate arrangement.

Create a Hyperdrive configuration with these values:

- a unique configuration name;
- the public TCP hostname of the database tunnel;
- the Kondis database name;
- the `kondis_runtime` username and password;
- the Cloudflare Access client ID and secret for the Hyperdrive service token;
- the uploaded CA certificate;
- `sslmode=verify-ca`; and
- caching disabled.

The runtime role needs access to the Kondis schema, but must not be the role used to run migrations. Configure at least five origin connections for Hyperdrive; the deployment script uses five by default.

After creating Hyperdrive, copy its 32-character ID and export it as `KONDIS_HYPERDRIVE_ID` in the shell where you deploy:

```sh
export KONDIS_HYPERDRIVE_ID=0123456789abcdef0123456789abcdef
```

## Deploy the Workers

From the repository root, authenticate Wrangler and deploy an environment with:

```sh
mise run deploy:cloudflare -- my-instance
```

The environment name becomes part of the generated Worker names. The command creates the required R2 buckets and Cloudflare Queues, deploys the queue executor when enabled, and then deploys the API and web Workers. Use `--dry-run` to generate and inspect the Wrangler configuration without provisioning or deploying resources:

```sh
mise run deploy:cloudflare -- my-instance --dry-run
```

The deployment script uses the current Wrangler authentication. Run `wrangler login` first, or provide Wrangler's Cloudflare API credentials through the deployment environment. The web Worker has no hostname route unless you set `KONDIS_WEB_HOSTNAME`. To configure a custom domain for the web Worker, set it before running the command:

```sh
export KONDIS_WEB_HOSTNAME=app.example.com
mise run deploy:cloudflare -- my-instance
```

When `KONDIS_WEB_HOSTNAME` is set, the default route mode is `custom-domain`, which configures the hostname as a Cloudflare custom domain. The `route` mode and `KONDIS_WEB_ZONE_NAME` setting are used by the demo deployment for PR preview Workers; they are not needed for a normal deployment. The demo deployment configures them automatically in `deployment/demo/deploy.mjs`.

The API Worker does not replace the direct PostgreSQL connection used by migrations. Keep running `mise //server:migrate` with the migration connection described above whenever the database schema changes.

## Cloudflare Queues

Cloud API requests insert rows into `background_job` in the same transaction as the corresponding domain mutation. A dispatcher running once per minute publishes unpublished rows to Cloudflare Queues.

Until the cloud Node.js processor and its R2-backed handlers are deployed, only Worker-owned schedules are enabled. Set `KONDIS_CLOUD_NODE_PROCESSOR_ENABLED=true` during deployment only after the processor is running. Enabling it earlier creates Node-owned jobs that no process can complete.

The Worker currently consumes the portable credential-cleanup job. Heavy jobs remain on the Node.js polling processor, which claims rows with `FOR UPDATE SKIP LOCKED`. Hyperdrive is used only for runtime queries; migrations continue to use the direct PostgreSQL connection.

The cloud Node.js processor is a separate long-running deployment. Build the server image or distribution, provide the same direct PostgreSQL environment used by the existing Node.js runtime, and start it with:

```sh
export KONDIS_CLOUD_NODE_PROCESSOR_ENABLED=true
mise exec -- pnpm --dir server run build
mise exec -- pnpm --dir server run start:cloud-node-processor
```

Keep the processor running before deploying a Worker configuration with `KONDIS_CLOUD_NODE_PROCESSOR_ENABLED=true`. The Worker then exposes the admin `POST /api/v1/jobs` enqueue operation and enables the Node-owned schedules. Queue commands remain unavailable on the Worker because Cloudflare Queue administration is managed by deployment configuration.

When the `REALTIME` Durable Object binding is present, the API Worker validates event tickets before forwarding `/events` WebSocket upgrades. The Durable Object owns the connections and receives best-effort event publications from API and Queue invocations. Its migration is generated with the Worker configuration; do not deploy event-ticket routes without the binding.

Multipart uploads are buffered by the Worker and checked against the application limits before their bytes are staged in R2. Depending on the plan, Cloudflare request-size limits may be lower than the 256 MiB Strava takeout limit. Large archives should use a direct or multipart R2 upload flow and then enqueue a processing job; increasing the multipart endpoint limit cannot bypass the platform request limit.

Queue delivery and lease recovery are intentionally at least once. Job handlers must remain idempotent because a handler can complete an external side effect and lose its lease before recording completion. Application failures are written back to the transactional outbox and retried by the dispatcher. Cloudflare Queue retries are reserved for transport and runtime failures so the two retry systems do not race each other.
