import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkBraces, checkCache } from "./regressions.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const require = createRequire(import.meta.url);

export async function verifySecurityPatches() {
  const patches = JSON.parse(
    await readFile(new URL("./patched-packages.json", import.meta.url), "utf8"),
  );
  const result = spawnSync(
    "pnpm",
    [
      "--recursive",
      "list",
      "braces",
      "http-cache-semantics",
      "--depth",
      "Infinity",
      "--json",
    ],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `Cannot verify installed patches: ${result.stderr || result.stdout}`,
    );
  const installed = new Map(
    Object.keys(patches).map((name) => [name, new Map()]),
  );
  function walk(tree) {
    for (const group of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
    ]) {
      for (const [name, dependency] of Object.entries(tree[group] || {})) {
        installed.get(name)?.set(dependency.path, dependency.version);
        walk(dependency);
      }
    }
  }
  for (const tree of JSON.parse(result.stdout)) walk(tree);
  const verified = new Map();
  for (const [name, patch] of Object.entries(patches)) {
    const paths = installed.get(name);
    if (!paths.size)
      throw new Error(`Patched dependency not installed: ${name}`);
    for (const [directory, version] of paths) {
      if (version !== patch.version)
        throw new Error(
          `Unexpected ${name} version: ${version}; review its security patch`,
        );
      for (const [file, expected] of Object.entries(patch.files)) {
        const actual = createHash("sha256")
          .update(await readFile(join(directory, file)))
          .digest("hex");
        if (actual !== expected)
          throw new Error(
            `Missing or modified security patch: ${name}/${file}`,
          );
      }
      const dependency = require(join(directory, "index.js"));
      if (name === "braces") checkBraces(dependency);
      else checkCache(dependency);
    }
    verified.set(patch.advisory, { name, version: patch.version });
    console.log(
      `Verified ${name}@${patch.version} security patch and regressions (${paths.size} installed instance)`,
    );
  }
  return verified;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await verifySecurityPatches();
}
