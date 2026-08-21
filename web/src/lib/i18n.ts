import source from "$i18n/en.json";
import swedish from "$i18n/sv.json";

type TranslationKey = keyof typeof source;
type Catalog = typeof source;

const catalogs: Record<string, Catalog> = { en: source, sv: swedish };

const configuredLocale = import.meta.env.PUBLIC_KONDIS_LOCALE
  ?.toLowerCase()
  .split("-", 1)[0];
const preferredLocale = () =>
  configuredLocale && configuredLocale in catalogs ? configuredLocale : "en";

export function t(
  key: TranslationKey,
  values: Record<string, string | number> = {},
) {
  let value = catalogs[preferredLocale()][key];
  for (const [name, replacement] of Object.entries(values)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}
