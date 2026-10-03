import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "kondis-org",
    compatibilityDate: "2026-08-24",
    workersDev: false,
    previewUrls: true,
    observability: {
      enabled: true,
      headSamplingRate: 1,
      redactQueryString: false,
      logs: {
        enabled: true,
        headSamplingRate: 1,
        persist: true,
        invocationLogs: true,
      },
      traces: {
        enabled: true,
        persist: true,
        headSamplingRate: 1,
      },
    },
    assets: {
      notFoundHandling: "404-page",
    },
    domains: ["kondis.org"],
  },
});
