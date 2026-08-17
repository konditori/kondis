# Kondis

An open source, self-hosted fitness tracker.

Let's do to commercial fitness platforms what Immich did to photo hosting.

The name is Nordic slang for "conditioning"

## Goals (subject to change)

1. Mobile apps with fast, reliable workout tracking
2. Workout analysis and route map display
3. Support for .fit and .gpx files
4. Multi-user support with roles and shared environments
5. Privacy-first defaults with self-hosted ownership of data

## Development

```bash
mise run dev
```

The web app is available at [http://localhost:3000](http://localhost:3000) and proxies API requests to the server container on port 2293.

### Android app

The native Kotlin/Jetpack Compose client lives in [`android/`](./android). See the [Android README](./android/README.md) for its feature set, architecture, setup, and verification commands.

### Database migrations

Migrations live in `server/src/schema/migrations` and are discovered automatically at runtime. Create a timestamped migration, apply pending migrations, or revert the latest migration with:

```bash
mise //server:migrations create AddActivityTags
mise //server:migrations run
mise //server:migrations revert
```

Review and implement both `up` and `down` in every generated migration before applying it.

### Medium tests

The CI-equivalent server integration suite is a root-level Mise task. Run it from
any directory in the repository with:

```bash
mise run //:ci:server-medium
```

It installs the server dependencies and runs the same medium suite as CI. The tests
use Testcontainers, so `docker info` must succeed first. The matching typecheck is:

```bash
mise run //:ci:server-medium-typecheck
```

Use the root-qualified `//:` commands above instead of relying on the current
directory; `server` has similarly named component tasks for internal composition.

### Generated CI artifacts

These files are checked for drift in CI. Regenerate them before pushing changes to
the API or production server dependencies:

```bash
mise run //server:install
(cd open-api && mise run //:open-api)
mise run //:third-party-licenses
```

The generated files are committed: `open-api/kondis-openapi-specs.json`,
`server/src/open-api/fetch-client.ts`, and `THIRD-PARTY-LICENSES.md`.

## License

Kondis is licensed under AGPL-3.0-or-later; see [LICENSE](./LICENSE).

Bundled third-party dependencies and their notices are listed in
[THIRD-PARTY-LICENSES.md](./THIRD-PARTY-LICENSES.md).
