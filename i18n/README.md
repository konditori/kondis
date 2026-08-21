# Translations

Kondis uses this directory as the shared translation catalog for the server,
web, and Android clients. The English catalog is the source of truth:
[`en.json`](./en.json). Each additional locale is a sibling JSON file named
with its BCP 47 language tag, for example `sv.json`, `de.json`, or
`pt-BR.json`.

## Adding strings

Add a stable, flat key to `en.json`. Keys are part of the client contract and
must not be renamed just to improve wording. Use ICU MessageFormat syntax for
variables and plurals, for example `{count, plural, one {# activity} other
{# activities}}`. Translations must preserve every variable used by the source
string.

The catalog is intentionally independent of a client framework. Client
integrations should read the locale catalog directly or generate their native
resource format from it; they must not create a second translation source.

## Weblate setup

When hosted Weblate is enabled, create one project with one component using:

| Setting                        | Value                    |
| ------------------------------ | ------------------------ |
| File mask                      | `i18n/*.json`            |
| Monolingual base language file | `i18n/en.json`           |
| File format                    | JSON files (monolingual) |
| Source language                | `en`                     |
| Repository branch              | `main`                   |

Weblate can commit translated locale files back to this repository. Do not
edit generated locale files manually once Weblate is active; source wording
and new keys belong in `en.json`.

## Validation

Run `mise run //:i18n:check`. The check verifies that locale files are valid
JSON, contain only keys from `en.json`, and preserve the source placeholders.
