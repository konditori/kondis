# Self-hosted PostgreSQL

This is the PostgreSQL origin for Cloudflare-deployed Kondis environments. It
is intentionally separate from the demo stack: the database host runs only
PostgreSQL, while Cloudflare runs the application Workers.

## Host setup

On the database host:

```sh
mkdir -p /srv/kondis-db/{data,secrets,tls}
cp deployment/postgres/.env.example deployment/postgres/.env
```

Create these four files in `/srv/kondis-db/secrets`:

```text
migrator-username
migrator-password
runtime-username
runtime-password
```

The username files should contain `kondis_migrator` and `kondis_runtime`. Use
long random values for both password files and make all secret files mode 600.

Place a publicly trusted TLS certificate and key at the paths configured by
`KONDIS_DB_TLS_CERT` and `KONDIS_DB_TLS_KEY`. The certificate SAN must contain
the hostname used by Hyperdrive. A self-signed certificate is not suitable for
the Cloudflare connection.

Start PostgreSQL and apply migrations with:

```sh
./bin/db.sh up
./bin/db.sh migrate
```

`migrate` builds the server image from the checked-out Git commit and runs the
repository migrations once against the local database. It does not run a
Worker and does not expose PostgreSQL beyond localhost.

The Hyperdrive connection should use `kondis_runtime`; CI or an operator uses
`kondis_migrator` for migrations. The runtime role is created on the first
database initialization and receives DML permissions plus default privileges
for objects created by the migration role.
