import source from "$i18n/en.json";

type TranslationKey = keyof typeof source;

export function t(
  key: TranslationKey,
  values: Record<string, string | number> = {},
) {
  let value = source[key];
  for (const [name, replacement] of Object.entries(values)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}
