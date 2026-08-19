import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    allowedHosts:
      process.env.KONDIS_VITE_ALLOWED_HOSTS === "true" ? true : undefined,
    watch:
      process.env.KONDIS_VITE_USE_POLLING === "true"
        ? { usePolling: true, interval: 250 }
        : undefined,
  },
});
