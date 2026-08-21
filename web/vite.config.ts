import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, type ProxyOptions } from "vite";

export default defineConfig(() => {
  const allowedHosts = process.env.KONDIS_VITE_ALLOWED_HOSTS?.trim();
  const allowedHostsConfig: true | string[] | undefined =
    allowedHosts === "true"
      ? true
      : allowedHosts
        ? allowedHosts.split(/[\s,]+/).filter(Boolean)
        : undefined;
  const apiTarget = process.env.KONDIS_API_URL ?? "http://localhost:2293";
  const eventsProxy: ProxyOptions = {
    target: apiTarget,
    changeOrigin: true,
    ws: true,
  };

  return {
    plugins: [sveltekit()],
    server: {
      allowedHosts: allowedHostsConfig,
      // Match Immich's development setup: Vite is the browser-facing
      // development server and proxies WebSocket upgrades to the API.
      proxy: {
        "/events": eventsProxy,
        "/api/v1/events": eventsProxy,
      },
      watch:
        process.env.KONDIS_VITE_USE_POLLING === "true"
          ? { usePolling: true, interval: 250 }
          : undefined,
    },
    preview: {
      proxy: {
        "/events": eventsProxy,
        "/api/v1/events": eventsProxy,
      },
    },
  };
});
