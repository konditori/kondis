---
title: Recording with Android
---

# Recording with Android

The Android client uses Kotlin and Jetpack Compose. Start a workout from Record, grant location permission, and keep the recording notification enabled so Android does not stop the foreground service.

Recordings are saved locally first. Pending activities upload when the server is reachable, which makes recording safe in areas with poor reception.
