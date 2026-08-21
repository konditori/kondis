import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const directory = new URL("../i18n/", import.meta.url);
const source = JSON.parse(
  await readFile(new URL("en.json", directory), "utf8"),
);
const sourceKeys = new Set(Object.keys(source));

const placeholders = (value) =>
  [...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)[^}]*\}/g)]
    .map((match) => match[1])
    .sort();

const files = (await readdir(directory)).filter(
  (file) => extname(file) === ".json",
);
for (const file of files) {
  if (file === "en.json") continue;

  const locale = JSON.parse(
    await readFile(join(directory.pathname, file), "utf8"),
  );
  const localeKeys = Object.keys(locale);
  const unknownKeys = localeKeys.filter((key) => !sourceKeys.has(key));
  const missingKeys = [...sourceKeys].filter((key) => !(key in locale));
  const invalidPlaceholders = [...sourceKeys].filter(
    (key) =>
      key in locale &&
      JSON.stringify(placeholders(source[key])) !==
        JSON.stringify(placeholders(locale[key])),
  );

  if (unknownKeys.length || missingKeys.length || invalidPlaceholders.length) {
    console.error(`${file}: translation catalog is out of sync`);
    if (unknownKeys.length)
      console.error(`  unknown keys: ${unknownKeys.join(", ")}`);
    if (missingKeys.length)
      console.error(`  missing keys: ${missingKeys.join(", ")}`);
    if (invalidPlaceholders.length)
      console.error(
        `  placeholder mismatch: ${invalidPlaceholders.join(", ")}`,
      );
    process.exitCode = 1;
  }
}

const kotlinFiles = [];
const collectKotlinFiles = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectKotlinFiles(path);
    } else if (entry.name.endsWith(".kt")) {
      kotlinFiles.push(path);
    }
  }
};

const androidSourceDirectory = new URL("../android/app/src/main/java/", import.meta.url);
const runtimeKeyPattern = /(?:\btr|\.tr)\(\s*"([a-zA-Z0-9_]+)"/g;
const legacyKeys = new Set([
  "app_name",
  "recording_channel_name",
  "recording_channel_description",
  "recording_notification_title",
]);
await collectKotlinFiles(androidSourceDirectory.pathname);
for (const file of kotlinFiles) {
  const sourceText = await readFile(file, "utf8");
  for (const match of sourceText.matchAll(runtimeKeyPattern)) {
    const key = match[1];
    if (!sourceKeys.has(key) && !legacyKeys.has(key)) {
      const line = sourceText.slice(0, match.index).split("\n").length;
      console.error(`${file}:${line}: unknown translation key: ${key}`);
      process.exitCode = 1;
    }
  }
}

const webSourceDirectory = new URL("../web/src/", import.meta.url);
const webFiles = [];
const collectWebFiles = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collectWebFiles(path);
    else if (entry.name.endsWith(".svelte")) webFiles.push(path);
  }
};
await collectWebFiles(webSourceDirectory.pathname);

const webKeyPattern = /\bt\(\s*["']([a-zA-Z0-9_]+)["']/g;
for (const file of webFiles) {
  const sourceText = await readFile(file, "utf8");
  for (const match of sourceText.matchAll(webKeyPattern)) {
    const key = match[1];
    if (!sourceKeys.has(key)) {
      const line = sourceText.slice(0, match.index).split("\n").length;
      console.error(`${file}:${line}: unknown translation key: ${key}`);
      process.exitCode = 1;
    }
  }
}

const hardcodedUiString = /(?:Text|contentDescription)\s*\(?(?:\s*=\s*)?"/;
for (const file of kotlinFiles) {
  const sourceText = await readFile(file, "utf8");
  for (const [index, line] of sourceText.split("\n").entries()) {
    if (hardcodedUiString.test(line)) {
      console.error(
        `${file}:${index + 1}: hardcoded user-visible Compose string`,
      );
      process.exitCode = 1;
    }
  }
}
