# Self-hosted PostgreSQL

This is the PostgreSQL origin for Cloudflare-deployed Kondis environments. It
is intentionally separate from the demo stack: the database host runs only
PostgreSQL, while Cloudflare runs the application Workers.

## Host setup

On the database host:

```sh
mkdir -p /srv/postgres/{data,secrets,tls}
cp deployment/postgres/env.example deployment/postgres/.env
```

Create these four files in `/srv/postgres/secrets`:

```text
migrator-username
migrator-password
runtime-username
runtime-password
```

The username files should contain `kondis_migrator` and `kondis_runtime`. Use
long random values for both password files and make all secret files mode 600.

Place a stable self-signed TLS certificate and key at the paths configured by
`KONDIS_DB_TLS_CERT` and `KONDIS_DB_TLS_KEY`. Upload the public certificate to
Hyperdrive as a CA certificate and create its configuration with
`sslmode=verify-ca`. This avoids relying on a public certificate authority;
do not regenerate the certificate after Hyperdrive is configured.

Start PostgreSQL with:

```sh
./bin/db.sh up
```

Do not run `./bin/db.sh migrate` on the 1 GB VPS: it builds the Node server
image there and can exhaust memory. Run migrations from GitHub Actions or a
development machine through the Cloudflare Tunnel instead.

The default `HDD` storage preset is intended for a modest VPS.

The Hyperdrive connection should use `kondis_runtime`; CI or an operator uses
`kondis_migrator` for migrations. The runtime role is created on the first
database initialization and receives DML permissions plus default privileges
for objects created by the migration role.

## Tunnel-backed migrations

Use the same Cloudflare Tunnel that Hyperdrive will use, with a public TCP
hostname that routes to `tcp://127.0.0.1:5432` on this host. Protect that
hostname with an Access application. Its policy must include a `Service Auth`
rule for a dedicated `kondis-migrations` service token. Do not give GitHub the
Hyperdrive service token.

For a local migration, install `cloudflared`, then export the following values
and run the Mise task from the repository root:

```sh
export KONDIS_DB_TUNNEL_HOSTNAME=postgres-tunnel.example.com
export KONDIS_DB_TUNNEL_CLIENT_ID=...
export KONDIS_DB_TUNNEL_CLIENT_SECRET=...
export KONDIS_DB_DATABASE_NAME=kondis
export KONDIS_DB_USERNAME=kondis_migrator
export KONDIS_DB_PASSWORD=...
mise run postgres:migrate
```

The task starts `cloudflared access tcp` on `127.0.0.1:15432`, runs the
migration against that local endpoint, and terminates the proxy afterwards.

The `Migrate PostgreSQL` GitHub workflow runs only on `main` (or manually),
never on pull requests. Create a GitHub Environment named `production` and
set these values there before enabling it:

| Type | Name |
| --- | --- |
| Variable | `KONDIS_DB_TUNNEL_HOSTNAME` |
| Variable | `KONDIS_DB_DATABASE_NAME` |
| Secret | `KONDIS_DB_MIGRATOR_USERNAME` |
| Secret | `KONDIS_DB_MIGRATOR_PASSWORD` |
| Secret | `KONDIS_DB_TUNNEL_CLIENT_ID` |
| Secret | `KONDIS_DB_TUNNEL_CLIENT_SECRET` |

PR previews must use a separate database (or schema and role) per preview.
They must not receive these production migration secrets or migrate this shared
database.
