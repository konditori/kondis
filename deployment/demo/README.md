# Cloudflare demo environments

The public demo and PR previews run as Cloudflare Workers backed by PostgreSQL
on the small VPS described in `deployment/postgres/README.md`.

## Main demo

Every push to `main` runs `.github/workflows/demo.yml`. The workflow:

1. Replaces `kondis-demo-web` with a small maintenance Worker.
2. Drops and recreates only the `kondis-demo` database.
3. Applies every migration and loads deterministic demo fixtures.
4. Updates the stable `kondis-demo` Hyperdrive configuration.
5. Deploys `kondis-demo-api` and `kondis-demo-web` from the same commit.
6. Smoke-tests the replacement Worker at `/api/v1/ping`.

The maintenance implementation uses the stable web Worker name and Custom
Domain. A successful web deployment atomically replaces it. It remains deployed
if reset, seeding, Hyperdrive configuration, or Worker deployment fails. A
failed public smoke test redeploys it.

## PR previews

Internal PRs get isolated resources named from the PR number:

| Resource | Example for PR 42 |
| --- | --- |
| Database | `kondis-demo-pr-42` |
| Runtime role | `kondis_demo_pr_42` |
| Hyperdrive | `kondis-demo-pr-42` |
| API Worker | `kondis-demo-api-pr-42` |
| Web Worker | `kondis-demo-web-pr-42` |
| URL | `https://pr-42.demo.kondis.org` |

`.github/workflows/demo-preview.yml` recreates and seeds the database on each
PR update. It creates or updates one Hyperdrive configuration with a soft
five-connection origin limit, then deploys both Workers. The trusted
default-branch `.github/workflows/demo-preview-cleanup.yml` workflow deletes the
Workers, Hyperdrive configuration, database, and role when the PR closes. It
also supports manual cleanup by PR number.

Fork PRs are intentionally skipped because preview deployment executes PR code
with Cloudflare and database credentials. Treat Environment approval as a trust
decision: only approve code from trusted internal contributors, and scope the
preview Cloudflare API token as narrowly as the platform permits.

Each active preview can allow up to five Hyperdrive origin connections. Keep
the number of active previews within the PostgreSQL connection and memory
budget, and use the manual cleanup workflow for abandoned previews.

Create a proxied wildcard DNS record for `*.demo.kondis.org` before enabling
previews. The exact PR hostname is attached using a Worker Route; the wildcard
record only makes those hostnames resolvable.

## GitHub Environment

Create a GitHub Environment named `demo` for main deployments and a
`demo-preview` Environment for PR deployments. Restrict `demo` to the `main`
branch. Configure a required reviewer on `demo-preview`, because approved PR
code runs build tooling while deployment credentials are present. PR teardown
uses trusted default-branch code and the `demo` Environment, so it is not
blocked by preview approval.

Production migrations and demo database lifecycle commands take one PostgreSQL
advisory lock before starting. This serializes migration and seed load against
the 1 GB host without dropping queued GitHub Actions jobs for other PRs.

Variables:

| Name | Purpose |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Account containing the Workers and Hyperdrive configs |
| `KONDIS_DB_TUNNEL_HOSTNAME` | Access-protected TCP Tunnel hostname |
| `KONDIS_HYPERDRIVE_ID` | Stable main demo Hyperdrive ID |
| `KONDIS_HYPERDRIVE_CA_CERTIFICATE_ID` | Uploaded PostgreSQL CA certificate ID |

Secrets:

| Name | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Workers, Workers Routes, and Hyperdrive edit access |
| `KONDIS_DB_MIGRATOR_PASSWORD` | Password for `kondis_migrator` |
| `KONDIS_DB_RUNTIME_PASSWORD` | Stable password for main `kondis_runtime` |
| `KONDIS_DB_TUNNEL_CLIENT_ID` | Migration service-token Client ID |
| `KONDIS_DB_TUNNEL_CLIENT_SECRET` | Migration service-token Client Secret |
| `KONDIS_HYPERDRIVE_ACCESS_CLIENT_ID` | Hyperdrive service-token Client ID |
| `KONDIS_HYPERDRIVE_ACCESS_CLIENT_SECRET` | Hyperdrive service-token Client Secret |

The two Access tokens must be separate and included in a `Service Auth` policy
for the PostgreSQL Tunnel application. The zone WAF rules must not challenge or
block WebSocket traffic to that hostname before Access evaluates it.

## Manual operations

Generate deployment configurations without changing Cloudflare:

```sh
KONDIS_HYPERDRIVE_ID=0123456789abcdef0123456789abcdef \
  mise run deploy:demo -- --dry-run
KONDIS_HYPERDRIVE_ID=0123456789abcdef0123456789abcdef \
  mise run deploy:demo -- --dry-run --pr 42
```

The database lifecycle commands deliberately reject names other than
`kondis-demo` and `kondis-demo-pr-N`.
