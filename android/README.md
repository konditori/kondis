# Kondis for Android

The native Android client for Kondis. It is an offline-friendly Jetpack Compose app that connects directly to a self-hosted Kondis API.

## Current milestone

- Activity feed with search, pagination, offline Room cache, route previews, and metric/imperial formatting
- Activity details with route, summary metrics, and kilometre splits
- Foreground GPS recording with pause/resume, elapsed time, distance filtering, and a persistent notification
- GPX generation, durable Room queueing, WorkManager retry, and upload through the existing `POST /api/v1/upload/activity` endpoint
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

The default API URL is `http://10.0.2.2:2293/api/v1/`, which reaches the host machine from the Android Emulator. For a physical device, enter the server URL on the sign-in screen or in Settings, such as `http://192.168.1.20:2293/api/v1/`. A build-time default can also be supplied with `./gradlew -Pkondis.apiUrl=https://kondis.example/api/v1/ :app:assembleRelease`.

Plain HTTP is supported for local self-hosting. Use HTTPS whenever traffic leaves a trusted local network.

## Verify

```bash
./gradlew ktlintCheck :app:lintDebug :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease
```

The repository uses mise for its pinned JavaScript/server toolchain. If you are
starting from a fresh checkout, run `mise install` from the repository root before
starting the backend. Android verification itself runs through the Gradle wrapper;
use Android Studio's JDK 17+ or another JDK 17+ installation.

The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`.

Use `./gradlew ktlintFormat` to automatically fix most Kotlin formatting failures.

## Continuous integration and delivery

The Android GitHub Actions workflow runs ktlint, Android lint, unit tests, an emulator end-to-end sync
test, and both debug and minified release builds. Kotlin compiler warnings and Android lint warnings fail
the build. Successful builds on `main` publish a downloadable debug APK in the workflow run.

In GitHub branch protection, require the `Android / Lint, Test & Build` status check before merging.
Dependabot checks the Gradle and GitHub Actions dependencies weekly and opens grouped update pull requests.

Tags matching `android-v*` also create a signed GitHub prerelease. Configure these repository secrets
before creating a release tag:

- `ANDROID_SIGNING_KEY_BASE64`: the release JKS keystore encoded with `base64`
- `ANDROID_SIGNING_STORE_PASSWORD`: the keystore password
- `ANDROID_SIGNING_KEY_ALIAS`: the signing-key alias
- `ANDROID_SIGNING_KEY_PASSWORD`: the signing-key password

For example, release version `0.2.0` with `git tag android-v0.2.0` followed by
`git push origin android-v0.2.0`. Keep the original keystore and passwords backed up securely: Android
updates must be signed with the same key.

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

## Signing in behind a perimeter gateway

Some self-hosted deployments sit behind a perimeter gateway such as [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/) rather than being reachable directly. On every sign-in attempt, the app first calls `GET /api/v1/auth/capabilities` without any credentials and inspects the response:

- A clean `200` means there is no gateway; the app shows the normal Kondis email/password form.
- A `401` advertising OAuth/OIDC discovery metadata (RFC 8414/RFC 9728 — this is what Cloudflare Access sends once [Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/) is enabled) opens the identity provider's login page in an [Auth Tab](https://developer.android.com/develop/ui/views/layout/webapps/auth-tab) (`androidx.browser.auth.AuthTabIntent`) — never a WebView, see `ExternalAuthManager`'s KDoc for why — then shows the Kondis email/password form once that completes.
- Anything else (a `302` to a login page, a gateway with no Managed OAuth) is reported to the user as unsupported; this app never scrapes a browser cookie to work around it.

This is provider-neutral: any authorization server that supports RFC 7591 dynamic client registration works, not just Cloudflare Access. Manually configured (non-DCR) providers are not yet supported.

The OAuth redirect lands on a single, Kondis-owned HTTPS App Link — `https://auth.kondis.app/android/oauth2redirect` by default — shared by every deployment, because identity providers are configured with one fixed, pre-registered redirect URI. Override it with `-Pkondis.oauthRedirectUri=https://your-domain/path` if you fork this app under a different `applicationId` or want to host your own callback. Whichever domain is configured must serve a Digital Asset Links file for Android to verify the App Link:

```jsonc
// https://<host>/.well-known/assetlinks.json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.kondis",
      "sha256_cert_fingerprints": ["<SHA-256 fingerprint of the release signing certificate>"]
    }
  }
]
```

Get the fingerprint with `keytool -list -v -keystore <release-keystore>` (or `-alias <debug-alias> -keystore ~/.android/debug.keystore -storepass android` for local testing). Add one entry per signing certificate the app is distributed with (Play Store app signing key, debug key, F-Droid/fork keys, and so on) — App Link verification silently fails for any certificate not listed here.

On the Cloudflare Access side, enable Managed OAuth on the application and add the callback URL above (with dynamic client registration enabled) to its allowed redirect URIs.

## Recording notes

Starting a workout must happen while the app is visible. Android then allows the location foreground service to continue through screen-off and background use. Finishing writes a GPX file to private app storage and queues the workout in Room. WorkManager uploads queued files when connectivity is available; a failed upload leaves both the GPX and the local workout visible until a later retry succeeds.

The next reliability milestone should checkpoint active recordings to disk, so process death during an active workout is fully covered.
