import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const root = new URL("../", import.meta.url);
const catalogDirectory = new URL("i18n/", root);
const resourceDirectory = new URL("android/app/src/main/res/", root);
const source = JSON.parse(await readFile(new URL("en.json", catalogDirectory), "utf8"));
const sourceKeys = Object.keys(source);
const legacyResourceKeys = new Set([
  "app_name",
  "recording_channel_name",
  "recording_channel_description",
  "recording_notification_title",
]);
const resourceName = (key) => (legacyResourceKeys.has(key) ? key : `i18n_${key}`);

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "\\\"")
    .replaceAll("'", "\\'");

const androidFormat = (value) => {
  const placeholders = new Map();
  const escaped = value.replaceAll("%", "%%");
  return escaped
    .replaceAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_, name) => {
      if (!placeholders.has(name)) placeholders.set(name, placeholders.size + 1);
      return `%${placeholders.get(name)}$s`;
    })
    .replaceAll("...", "&#8230;");
};

const resourceXml = (catalog) => `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated from i18n/*.json. Run: mise run //:i18n:android -->
<resources xmlns:tools="http://schemas.android.com/tools" tools:ignore="UnusedResources,TypographyEllipsis">
${sourceKeys.map((key) => `    <string name="${resourceName(key)}">${escapeXml(androidFormat(catalog[key]))}</string>`).join("\n")}
</resources>
`;

const localeDirectoryName = (locale) =>
  locale === "en" ? "values" : `values-b+${locale.replaceAll("-", "+")}`;

for (const file of await readdir(catalogDirectory)) {
  if (extname(file) !== ".json") continue;
  const locale = file.slice(0, -".json".length);
  const catalog = JSON.parse(await readFile(new URL(file, catalogDirectory), "utf8"));
  const missing = sourceKeys.filter((key) => !(key in catalog));
  const unknown = Object.keys(catalog).filter((key) => !(key in source));
  if (missing.length || unknown.length) {
    throw new Error(`${file} does not match i18n/en.json`);
  }

  const directory = join(resourceDirectory.pathname, localeDirectoryName(locale));
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "strings.xml"), resourceXml(catalog));
}

// Locale resource directories are generated. Remove obsolete languages so a
// deleted Weblate catalog cannot remain bundled in the app.
for (const directory of await readdir(resourceDirectory)) {
  if (!directory.startsWith("values-b+")) continue;
  const locale = directory.slice("values-b+".length).replaceAll("+", "-");
  const catalog = join(catalogDirectory.pathname, `${locale}.json`);
  try {
    await readFile(catalog);
  } catch {
    await rm(join(resourceDirectory.pathname, directory), { recursive: true });
  }
}
