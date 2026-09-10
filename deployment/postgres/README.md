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

Start PostgreSQL and apply migrations with:

```sh
./bin/db.sh up
./bin/db.sh migrate
```

`migrate` builds the server image from the checked-out Git commit and runs the
repository migrations once against the local database. It does not run a
Worker and does not expose PostgreSQL beyond localhost.

The default `HDD` storage preset is intended for a modest VPS. For CI
migrations, prefer running the migration process through an SSH tunnel
from GitHub Actions so the VPS does not need to build the Node image and can
reserve its memory for PostgreSQL.

The Hyperdrive connection should use `kondis_runtime`; CI or an operator uses
`kondis_migrator` for migrations. The runtime role is created on the first
database initialization and receives DML permissions plus default privileges
for objects created by the migration role.
