import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, type ProxyOptions } from "vite";

const upstream: ProxyOptions = {
  target: process.env.KONDIS_API_URL ?? "http://localhost:2293",
  changeOrigin: true,
  secure: false,
};

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    proxy: { "/api": upstream },
    watch:
      process.env.KONDIS_VITE_USE_POLLING === "true"
        ? { usePolling: true, interval: 250 }
        : undefined,
  },
  preview: { proxy: { "/api": upstream } },
});
