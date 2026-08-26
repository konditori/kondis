---
title: Local development
---

# Local development

```bash
mise install
mise run dev
```

The web app is at `http://localhost:3000` and the server at `2293`.

The development environment reads `docker/.env`. Set `DATA_LOCATION` to the host directory where application data should be stored, for example `./data`. PostgreSQL data is stored in the Docker-managed `postgres_data` volume because bind-mounted database directories are not safe on Docker Desktop's shared filesystem.

```bash
mise run //server:check
mise run //server:test
mise run //:ci:server-medium
mise run //:ci:server-medium-typecheck
```

The medium suite uses Testcontainers, so Docker must be available. Android verification:

```bash
cd android
./gradlew ktlintCheck :app:lintDebug :app:testDebugUnitTest :app:assembleDebug
```
