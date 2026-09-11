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

The stable main Hyperdrive connection uses `kondis_runtime`; CI uses
`kondis_migrator` to administer disposable demo databases. The runtime role is
created on first cluster initialization. Each PR receives a separate restricted
runtime role.

## Tunnel-backed migrations

Use the same Cloudflare Tunnel that Hyperdrive will use, with a public TCP
hostname that routes to `tcp://127.0.0.1:5432` on this host. Protect that
hostname with an Access application. Its policy must include a `Service Auth`
rule for separate migration and Hyperdrive service tokens. GitHub needs both in
the protected `demo` Environment: one for its local migration proxy, and one
for creating Hyperdrive configurations.

For a local migration, install `cloudflared`, then export the following values
and run the Mise task from the repository root:

```sh
export KONDIS_DB_TUNNEL_HOSTNAME=postgres-tunnel.example.com
export KONDIS_DB_TUNNEL_CLIENT_ID=...
export KONDIS_DB_TUNNEL_CLIENT_SECRET=...
export KONDIS_DB_DATABASE_NAME=kondis-demo
export KONDIS_DB_MIGRATOR_USERNAME=kondis_migrator
export KONDIS_DB_MIGRATOR_PASSWORD=...
mise run postgres:migrate
```

The task starts `cloudflared access tcp` on `127.0.0.1:15432`, waits for its
local listener, runs the migration once, and terminates the proxy afterwards.
`cloudflared access tcp` opens its upstream WebSocket on demand when the
migration connects.

The demo workflows do not merely migrate an existing database. Main recreates
`kondis-demo` on every push, and each internal PR recreates its own
`kondis-demo-pr-N` database. The administration command refuses any other
database naming pattern, revokes public database access, creates a restricted
runtime role, and grants only application DML privileges.

See `deployment/demo/README.md` for workflow configuration and resource
lifecycle details.
