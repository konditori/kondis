import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

const allowedHosts = process.env.KONDIS_VITE_ALLOWED_HOSTS?.trim();

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    allowedHosts:
      allowedHosts === "true"
        ? true
        : allowedHosts
          ? allowedHosts.split(/[\s,]+/).filter(Boolean)
          : undefined,
    watch:
      process.env.KONDIS_VITE_USE_POLLING === "true"
        ? { usePolling: true, interval: 250 }
        : undefined,
  },
});
