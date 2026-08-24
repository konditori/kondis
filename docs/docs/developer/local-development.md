---
title: Local development
---

# Local development

```bash
mise install
mise run dev
```

The web app is at `http://localhost:3000` and the server at `2293`.

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
