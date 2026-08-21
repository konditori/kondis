import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const directory = new URL("../web/src/", import.meta.url);
const files = [];

const collectFiles = async (path) => {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) await collectFiles(entryPath);
    else if (entry.name.endsWith(".svelte")) files.push(entryPath);
  }
};

await collectFiles(directory.pathname);

const userVisibleString =
  />\s*[A-Za-z][^<{]*<\/?[A-Za-z]|\b(?:aria-label|placeholder|title)\s*=\s*["'][^"']+["']/;

for (const file of files) {
  const sourceText = await readFile(file, "utf8");
  for (const [index, line] of sourceText.split("\n").entries()) {
    if (userVisibleString.test(line)) {
      console.error(`${file}:${index + 1}: hardcoded user-visible web string`);
      process.exitCode = 1;
    }
  }
}
