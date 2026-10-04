export const supportedLocales = ["en", "sv"] as const;
export type Locale = (typeof supportedLocales)[number];
export const localeContext = "kondis-locale";

export function resolveLocale(header: string | null, saved?: string): Locale {
  if (supportedLocales.includes(saved as Locale)) return saved as Locale;
  const preferences = (header ?? "")
    .split(",")
    .map((entry, index) => {
      const [language, ...parameters] = entry.trim().toLowerCase().split(";");
      const quality = parameters.find((part) => part.trim().startsWith("q="));
      return {
        locale: language.split("-")[0],
        quality: quality ? Number(quality.trim().slice(2)) : 1,
        index,
      };
    })
    .filter(
      ({ quality }) => Number.isFinite(quality) && quality > 0 && quality <= 1,
    )
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return (
    (preferences.find(({ locale }) =>
      supportedLocales.includes(locale as Locale),
    )?.locale as Locale) ?? "en"
  );
}
