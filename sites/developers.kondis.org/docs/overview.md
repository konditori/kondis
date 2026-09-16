---
title: Developer overview
---

# Developer overview

Kondis is a monorepo containing a Svelte web client, Hono/TypeScript server, Kotlin Android client, end-to-end tests, and PostgreSQL package. The OpenAPI document is checked in at `open-api/kondis-openapi-specs.json`.

Use `mise` for the pinned toolchain. Use the Gradle wrapper and JDK 17+ for Android.

### Database migrations

Migrations live in `server/src/schema/migrations` and are discovered automatically at runtime. Create a timestamped migration, apply pending migrations, or revert the latest migration with:

```bash
mise //server:migrations create ShinyNewFeature
```

### Android

The Android client uses the Gradle wrapper and requires JDK 17 or newer. From `android/`, run the full local verification with:

```bash
./gradlew ktlintCheck :app:lintDebug :app:testDebugUnitTest :app:assembleDebug
```

### Resetting data

You'll often want to reset the server contents, but maybe you don't feel like redoing the whole server setup?

Just run

```bash
mise dev-reset-data
```

in the project route and it'll delete all activities (be careful) and other things yet keep accounts in place.
