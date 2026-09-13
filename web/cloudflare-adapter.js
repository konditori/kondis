import cloudflareAdapter from "@sveltejs/adapter-cloudflare";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const maintenanceWorkerPath = new URL(
  "../deployment/demo/maintenance-worker.ts",
  import.meta.url,
);

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
      let worker = readFileSync(workerPath, "utf8");
      if (
        !worker.includes(legacyCacheRead) ||
        !worker.includes(legacyCacheWrite)
      ) {
        throw new Error(
          "Could not disable adapter-cloudflare's legacy page cache",
        );
      }

      if (process.env.KONDIS_DEMO_MODE === "true") {
        const maintenanceImportPath = path
          .relative(path.dirname(workerPath), maintenanceWorkerPath.pathname)
          .split(path.sep)
          .join("/");
        const normalizedMaintenanceImportPath =
          maintenanceImportPath.startsWith(".")
            ? maintenanceImportPath
            : `./${maintenanceImportPath}`;

        // The maintenance Worker temporarily uses the stable web Worker name.
        // Keep exporting its Durable Object class when the application replaces
        // that Worker, otherwise Cloudflare rejects the new version because the
        // existing Durable Object is still registered to this script.
        worker += `\nexport { MaintenanceTimerDurableObject } from "${normalizedMaintenanceImportPath}";\n`;
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
