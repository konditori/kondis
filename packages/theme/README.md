# Shared theme

`tokens.css` defines the palette used by the web app, landing page, documentation
sites and API reference. Change colors here before adding site-specific overrides.
`docs.css` maps these tokens to Docusaurus. Scalar's adapter lives in the API site's
`static/theme.css`.

Use `--accent` with `--on-accent` for filled controls and `--accent-text` for text
and links. The orange fill alone does not provide enough contrast for small text
on white. Use the semantic success, warning, danger and chart tokens for those
roles. Keep dotted backgrounds confined to the landing hero.

`preference.ts` owns system/light/dark preference, storage and system-theme
changes. `ThemePicker.svelte` is its accessible Svelte control. Docusaurus keeps
its native preference control with system appearance enabled.

Run `pnpm --dir e2e test:visual` after building the app and all public sites.
See [the regression suite](../../e2e/src/visual/README.md) for fixture coverage,
screenshots and preview capture instructions. The 200-activity fixture records
render time and verifies lazy map initialization; measure that workload before
introducing feed virtualization.
