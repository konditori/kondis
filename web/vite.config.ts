import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    watch:
      process.env.KONDIS_VITE_USE_POLLING === "true"
        ? { usePolling: true, interval: 250 }
        : undefined,
  },
});
