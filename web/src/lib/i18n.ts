import { createContext } from "svelte";
import source from "$i18n/en.json";
import swedish from "$i18n/sv.json";

type TranslationKey = keyof typeof source;
type Catalog = typeof source;

const catalogs = { en: source, sv: swedish } satisfies Record<string, Catalog>;
export type Locale = keyof typeof catalogs;

const [getLocale, setLocaleContext] = createContext<() => Locale>();

export function resolveLocale(acceptLanguage: string | null): Locale {
  const preferences = (acceptLanguage ?? "")
    .split(",")
    .map((preference, index) => {
      const [tag, ...parameters] = preference.trim().split(";");
      const qualityParameter = parameters.find((value) =>
        value.trim().startsWith("q="),
      );
      const quality = qualityParameter
        ? Number(qualityParameter.trim().slice(2))
        : 1;
      return { tag, quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { tag, quality } of preferences) {
    const locale = tag.toLowerCase().split("-", 1)[0];
    if (quality > 0 && locale in catalogs) return locale as Locale;
  }
  return "en";
}

export function setLocale(getLocale: () => Locale) {
  setLocaleContext(getLocale);
}

export function createTranslator() {
  const locale = getLocale();
  return (
    key: TranslationKey,
    values: Record<string, string | number> = {},
  ) => {
    let value = catalogs[locale()][key];
    for (const [name, replacement] of Object.entries(values)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
    return value;
  };
}
