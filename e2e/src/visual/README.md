# Theme regressions

Build the SDK, web app and all four public sites, then run `pnpm --dir e2e test:visual`.
The suite starts deterministic API fixtures and serves the actual production
builds. It does not require PostgreSQL or production credentials.

Coverage includes the feed at desktop and 390px widths, login, settings, activity
detail, both documentation sites and the API reference in light/dark mode. It
checks WCAG AA accessibility, missing mobile metrics, overflow, sidebar hit
testing, empty/error states, Swedish SSR/hydration, persisted/system appearance,
keyboard dismissal and photo-dialog focus. A 200-activity fixture verifies that
maps initialize only near the viewport and records the time to render the feed.

Feed screenshot baselines are committed for macOS Chromium; CI uses macOS for
consistent native font rendering. Map tiles and remote fonts are excluded from
pixel comparisons. Other pages attach screenshots to the HTML report and have
layout and accessibility assertions. To review an intentional visual change:

```sh
pnpm --dir e2e test:visual --update-snapshots
pnpm --dir e2e exec playwright show-report playwright-report/visual
```

Review the resulting PNGs before committing them. Keep the real API/import
browser tests in `src/specs/browser`; fixtures do not replace integration tests.

To refresh the landing page previews, run `node e2e/src/visual/serve.ts` from the
repository root and `node e2e/src/visual/capture.mjs` in another terminal. The
capture uses fictional activities rendered by the web app, real map tiles and
the current theme. Desktop and phone previews represent the web interface.
