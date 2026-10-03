import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// SvelteKit's static adapter produces `build/`, but cf's SvelteKit detection
// does not emit Build Output yet. Package those assets for `cf deploy`.
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(projectRoot, ".cloudflare/output/v0");
const workerOutput = join(outputRoot, "workers/default");
const { default: config } = await import("../cloudflare.config.ts");
const resolvedConfig =
  typeof config === "function"
    ? await config({ isPreview: false, mode: undefined })
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
      buildContext: { isPreview: false },
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
