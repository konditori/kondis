import { browser } from "$app/environment";
import { getContext } from "svelte";
import { localeContext, type Locale } from "$lib/locale";
import source from "$i18n/en.json";
import swedish from "$i18n/sv.json";

export type TranslationKey = keyof typeof source;
type Catalog = typeof source;

const catalogs: Record<string, Catalog> = { en: source, sv: swedish };

export const preferredLocale = (): Locale => {
  if (browser) return document.documentElement.lang === "sv" ? "sv" : "en";
  try {
    return getContext<(() => Locale) | undefined>(localeContext)?.() ?? "en";
  } catch {
    // Pure helpers and tests can run outside a Svelte component.
    return "en";
  }
};

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
