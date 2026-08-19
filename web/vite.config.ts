import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig(() => {
  const allowedHosts = process.env.KONDIS_VITE_ALLOWED_HOSTS?.trim();
  const allowedHostsConfig: true | string[] | undefined =
    allowedHosts === "true"
      ? true
      : allowedHosts
        ? allowedHosts.split(/[\s,]+/).filter(Boolean)
        : undefined;

  return {
    plugins: [sveltekit()],
    server: {
      allowedHosts: allowedHostsConfig,
      watch:
        process.env.KONDIS_VITE_USE_POLLING === "true"
          ? { usePolling: true, interval: 250 }
          : undefined,
    },
  };
});
