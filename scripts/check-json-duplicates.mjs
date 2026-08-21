import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const ignoredDirectories = new Set([".git", ".gradle", "build", "dist", "node_modules"]);
const jsonFiles = [];

const collectJsonFiles = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collectJsonFiles(path);
    else if (entry.name.endsWith(".json")) jsonFiles.push(path);
  }
};

const lineNumber = (source, offset) => source.slice(0, offset).split("\n").length;

const duplicateKeys = (source) => {
  let offset = 0;

  const skipWhitespace = () => {
    while (/\s/.test(source[offset] ?? "")) offset += 1;
  };

  const parseString = () => {
    const start = offset;
    offset += 1;
    while (offset < source.length) {
      if (source[offset] === "\\") offset += 2;
      else if (source[offset++] === '"') return JSON.parse(source.slice(start, offset));
    }
    throw new SyntaxError("Unterminated string");
  };

  const parseValue = (path) => {
    skipWhitespace();
    if (source[offset] === '"') {
      parseString();
      return;
    }
    if (source[offset] === "{") {
      parseObject(path);
      return;
    }
    if (source[offset] === "[") {
      offset += 1;
      skipWhitespace();
      if (source[offset] !== "]") {
        while (true) {
          parseValue(path);
          skipWhitespace();
          if (source[offset] === "]") break;
          if (source[offset++] !== ",") throw new SyntaxError("Expected comma in array");
          skipWhitespace();
        }
      }
      offset += 1;
      return;
    }
    while (offset < source.length && !/[\s,}\]]/.test(source[offset])) offset += 1;
  };

  const duplicates = [];
  const parseObject = (path) => {
    offset += 1;
    const keys = new Set();
    skipWhitespace();
    if (source[offset] === "}") {
      offset += 1;
      return;
    }
    while (true) {
      skipWhitespace();
      const keyOffset = offset;
      const key = parseString();
      if (keys.has(key)) duplicates.push({ key, path: `${path}.${key}`, line: lineNumber(source, keyOffset) });
      keys.add(key);
      skipWhitespace();
      if (source[offset++] !== ":") throw new SyntaxError("Expected colon after object key");
      parseValue(`${path}.${key}`);
      skipWhitespace();
      if (source[offset] === "}") break;
      if (source[offset++] !== ",") throw new SyntaxError("Expected comma in object");
    }
    offset += 1;
  };

  parseValue("$");
  return duplicates;
};

await collectJsonFiles(root);
let failed = false;
for (const file of jsonFiles) {
  const source = await readFile(file, "utf8");
  try {
    JSON.parse(source);
    for (const duplicate of duplicateKeys(source)) {
      console.error(`${relative(root, file)}:${duplicate.line}: duplicate JSON key ${duplicate.path}`);
      failed = true;
    }
  } catch (error) {
    console.error(`${relative(root, file)}: invalid JSON: ${error.message}`);
    failed = true;
  }
}

if (failed) process.exitCode = 1;