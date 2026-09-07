import cloudflareAdapter from "@sveltejs/adapter-cloudflare";
import { readFileSync, writeFileSync } from "node:fs";

const legacyCacheRead =
  'let res = !pragma.includes("no-cache") && await r2(req);';
const legacyCacheWrite =
  "return pragma && res.status < 400 ? c(req, res, ctx) : res;";

export default function cloudflareAdapterWithoutLegacyCache(options) {
  const adapter = cloudflareAdapter(options);

  return {
    ...adapter,
    async adapt(builder) {
      await adapter.adapt(builder);

      const workerPath = `${builder.getBuildDirectory("cloudflare")}/_worker.js`;
      const worker = readFileSync(workerPath, "utf8");
      if (
        !worker.includes(legacyCacheRead) ||
        !worker.includes(legacyCacheWrite)
      ) {
        throw new Error(
          "Could not disable adapter-cloudflare's legacy page cache",
        );
      }

      // Workers Cache handles response caching and is version-aware. The adapter's
      // legacy caches.default entries can otherwise outlive hashed static assets.
      writeFileSync(
        workerPath,
        worker
          .replace(legacyCacheRead, "let res;")
          .replace(legacyCacheWrite, "return res;"),
      );
    },
  };
}
