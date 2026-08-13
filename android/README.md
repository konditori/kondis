# Kondis for Android

The native Android client for Kondis. It is an offline-friendly Jetpack Compose app that connects directly to a self-hosted Kondis API.

## Current milestone

- Activity feed with search, pagination, offline Room cache, route previews, and metric/imperial formatting
- Activity details with route, summary metrics, and kilometre splits
- Foreground GPS recording with pause/resume, elapsed time, distance filtering, and a persistent notification
- GPX generation and upload through the existing `POST /api/v1/upload/activity` endpoint
- Configurable self-hosted server URL and unit preference through DataStore
- Light/dark Material 3 UI, edge-to-edge layout, adaptive icon, and Navigation 3 state restoration

This is the greenfield foundation, not yet a feature-complete Strava replacement. Planned product areas include resumable upload work, crash-safe recording checkpoints, Health Connect, sensors, richer analysis, editing, social/group features, and Wear OS.

## Toolchain

- Android Studio with JDK 17 or newer (JDK 21 is recommended)
- Android SDK 37
- Gradle 9.7 / Android Gradle Plugin 9.3
- Kotlin 2.4 with the Compose compiler plugin
- Minimum Android version: Android 8.0 (API 26)

Versions are pinned in [`gradle/libs.versions.toml`](gradle/libs.versions.toml). The project uses stable releases rather than alpha or beta artifacts.

## Run locally

Start the Kondis backend from the repository root:

```bash
mise run dev
```

Open this directory in Android Studio and run the `app` configuration, or use:

```bash
./gradlew :app:installDebug
```

The default API URL is `http://10.0.2.2:2293/api/v1/`, which reaches the host machine from the Android Emulator. For a physical device, open Settings in the app and enter an address the device can reach, such as `http://192.168.1.20:2293/api/v1/`.

Plain HTTP is supported for local self-hosting. Use HTTPS whenever traffic leaves a trusted local network.

## Verify

```bash
./gradlew testDebugUnitTest :app:assembleDebug :app:lintDebug
```

The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`.

## Architecture

The app follows Android's recommended single-activity, unidirectional-data-flow architecture:

```text
Compose screens → Hilt ViewModels → repositories → Retrofit / Room / DataStore
                                    ↘ foreground recording service → GPS → GPX upload
```

- UI state is exposed as immutable `StateFlow` values and collected with lifecycle awareness.
- Room is the local source of truth for activity browsing, so cached workouts remain visible offline.
- Retrofit models mirror `../open-api/kondis-openapi-specs.json`; unknown response fields are tolerated for forward compatibility.
- Navigation 3 owns a serializable back stack, including activity detail keys.
- The recording service owns location updates while a workout is active. It requires precise location and uses a low-importance foreground notification.
- Server URL and unit system are user-owned settings; the default URL is supplied through `BuildConfig`.

Keep Android-specific behavior inside `data`, `recording`, and `ui` packages. Introduce additional Gradle modules when independent feature ownership or build performance makes the boundary useful; a single module keeps this first vertical slice easy to change.

## Recording notes

Starting a workout must happen while the app is visible. Android then allows the location foreground service to continue through screen-off and background use. Finishing writes a GPX file to private app storage and uploads it. A failed upload leaves the GPX on the device rather than deleting workout data.

The next reliability milestone should checkpoint active recordings to disk and retry saved uploads with WorkManager, so process death and long offline periods are fully covered.

