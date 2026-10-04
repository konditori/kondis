import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

await rm("build", { recursive: true, force: true });
await mkdir("build", { recursive: true });
await cp("static", "build", { recursive: true });
await cp("../../packages/theme/tokens.css", "build/tokens.css");
await cp("../../open-api/kondis-openapi-specs.json", "build/openapi.json");
await cp(
  "node_modules/@scalar/api-reference/dist/browser/standalone.js",
  "build/scalar.js",
);
await writeFile(
  "build/preference.js",
  stripTypeScriptTypes(
    await readFile("../../packages/theme/preference.ts", "utf8"),
  ),
);
