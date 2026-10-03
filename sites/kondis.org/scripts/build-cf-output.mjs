import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Package a site's static `build/` directory as Build Output. This also lets
// preview deploys carry the preview build context through to `cf previews deploy`.
const projectRoot = process.cwd();
const outputRoot = join(projectRoot, ".cloudflare/output/v0");
const workerOutput = join(outputRoot, "workers/default");
const isPreview = process.argv.includes("--preview");
const configUrl = pathToFileURL(join(projectRoot, "cloudflare.config.ts"));
const { default: config } = await import(configUrl.href);
const resolvedConfig =
  typeof config === "function"
    ? await config({ isPreview, mode: undefined })
    : config;

if (!resolvedConfig.worker) {
  throw new Error("cloudflare.config.ts must define a Worker.");
}
if (resolvedConfig.worker.entrypoint) {
  throw new Error(
    "This build output script only supports assets-only Workers.",
  );
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(workerOutput, { recursive: true });
await writeFile(
  join(outputRoot, "config.json"),
  JSON.stringify(
    {
      ...(resolvedConfig.accountId && { accountId: resolvedConfig.accountId }),
      ...(resolvedConfig.complianceRegion && {
        complianceRegion: resolvedConfig.complianceRegion,
      }),
      buildContext: { isPreview },
    },
    null,
    2,
  ),
);
await writeFile(
  join(workerOutput, "worker.config.json"),
  JSON.stringify(resolvedConfig.worker, null, 2),
);
await cp(join(projectRoot, "build"), join(workerOutput, "assets"), {
  recursive: true,
});
