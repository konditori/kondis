# Kondis end-to-end tests

This package hosts two independent suites.

## Browser suite (Playwright)

Exercises the real product: production-built frontend and API, an isolated
PostgreSQL container, and an actual browser worker that extracts and uploads a
generated Strava takeout archive.

```sh
mise run //e2e:test-web
```

The task builds the SDK, server, and web production bundles, installs the
Playwright browsers, starts a disposable PostgreSQL container plus the API,
background worker, and frontend on throwaway ports (the frontend is fixed to
127.0.0.1:2396), and runs the suite. Chromium runs the full suite; Firefox and
WebKit run the `@smoke` tests. Everything it creates is torn down with the run
and never touches the developer databases from `docker compose dev`.

Prerequisites: Docker, the checked-out `test/test-assets` submodule
(`git submodule update --init --recursive`), and [mise](https://mise.jdx.dev/).
Playwright browsers can be (re)installed with `mise run //e2e:playwright-install`.

Useful reruns after the first build, from this directory:

```sh
mise exec -- pnpm exec playwright test                     # everything
mise exec -- pnpm exec playwright test --project=chromium  # Chromium only
KONDIS_E2E_SCALE=1 mise exec -- pnpm exec playwright test  # include @scale
```

Environment overrides:

- `KONDIS_E2E_SCALE=1` enables the larger-import responsiveness test. It runs
  weekly in CI and stays opt-in locally so PR checks remain fast.
- `KONDIS_E2E_POSTGRES_IMAGE` reuses an existing compatible image instead of
  building `packages/postgres` (PG17 + VectorChord) for the run's container.

Failure artifacts land in `test-results/` (traces and screenshots),
`playwright-report/`, and `browser-artifacts/servers.log` (API, worker,
frontend, and database output). All three directories are git-ignored and
uploaded by CI on failure.

## API suite (Vitest)

HTTP-level tests against the Docker application stack in `docker-compose.yml`:

```sh
mise run //e2e:test
```
