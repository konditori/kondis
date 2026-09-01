import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

const proxy = {
  target: process.env.KONDIS_API_URL ?? "http://localhost:2293",
  changeOrigin: true,
  ws: true,
};

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    allowedHosts: true,
    proxy: {
      "/events": proxy,
      "/api/v1/events": proxy,
    },
    watch:
      process.env.KONDIS_VITE_USE_POLLING === "true"
        ? { usePolling: true, interval: 250 }
        : undefined,
  },
  preview: {
    proxy: {
      "/events": proxy,
      "/api/v1/events": proxy,
    },
  },
});
