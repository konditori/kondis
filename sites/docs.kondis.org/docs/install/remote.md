---
sidebar_position: 4
title: Remote access
---

# Remote access

The server is set up, but it is hard to reach outside of your network. A remote access setup lets you use Kondis from the Android app and other devices without exposing the server directly to the internet.

We recommend against port forwarding and other methods to expose your server on the public Internet unless you really know what you are doing. We strongly encourage you to setup TLS in order to get a `https://` URL in order to achieve strong encryption and authentication with your server.

## VPN

A VPN let you access your home network through an encrypted tunnel. Popular VPNs for remote access include Wireguard and Tailscale.

### Tailscale

Tailscale is a commercial product with a free tier suitable for home use. Tailscale has a [great video on connecting to self-hosted services](https://www.youtube.com/watch?v=Vt4PDUXB_fg).

### Wireguard

Wireguard is an open source VPN system that you can host yourself without relying on a third party.

## Cloudflare

:::note
The main author of Kondis is a Cloudflare employee
:::

Cloudflare Tunnels, also known as Cloudflare ZTNA, is a commercial zero-trust solution with a free tier that allows up to 50 users. You connect to Kondis through a `cloudflared` instance on your network. Cloudflare manages DNS and TLS for you automatically but you need to own a domain name. Official instructions are found [here](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)

### Cloudflare Worker deployment

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
pnpm exec wrangler dev --config wrangler-generated-staging.json
```

The guarded `GET /api/v1/_internal/hyperdrive-spike` endpoint verifies the
PostgreSQL version, auth-session lookup, permission query, PostGIS matching,
VectorChord nearest-neighbor search, a transaction, and `FOR UPDATE`. Supply
the endpoint's bearer token through the `HYPERDRIVE_SPIKE_TOKEN` Worker secret;
without both the binding and token it returns 404.
Remove the `HYPERDRIVE_SPIKE_TOKEN` secret after the compatibility check; this
disables the diagnostic route again. Use a least-privileged runtime database
role for Hyperdrive and keep schema/DDL permissions on the separate direct
migration credential.

#### Cloud job queues

`pnpm cloudflare:deploy` also generates the four queue bindings, their
dead-letter queues, retry/concurrency settings, and Cron Triggers from
`src/jobs/job-semantics.ts`. The generated file is ignored and should not be
edited. Cloud API writes insert into `background_job` in the same transaction
as the domain mutation; the one-minute dispatcher publishes unpublished rows.

Until the cloud Node processor and its R2-backed handlers are deployed, only
Worker-owned schedules are enabled. Set
`KONDIS_CLOUD_NODE_PROCESSOR_ENABLED=true` during deployment only after that
processor is live; enabling it earlier would intentionally create Node-owned
jobs which no process can complete.

The Worker currently consumes the portable credential-cleanup job. Heavy jobs
remain for the Node polling processor, which claims rows with
`FOR UPDATE SKIP LOCKED`. Keep migrations on the direct PostgreSQL connection;
Hyperdrive is only used by runtime queries.

Queue delivery and lease recovery are intentionally at-least-once. Job
handlers must therefore remain idempotent: a handler can finish its external
side effect and lose its lease before recording completion. Application
failures are persisted back to the transactional outbox and retried by the
dispatcher; Cloudflare Queue retries are reserved for transport/runtime
failures so the two retry systems cannot race each other.
