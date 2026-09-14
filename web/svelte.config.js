import nodeAdapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import cloudflareAdapter from "./cloudflare-adapter.js";

const adapter =
  process.env.KONDIS_DEPLOY_TARGET === "cloudflare"
    ? cloudflareAdapter
    : nodeAdapter;

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      $i18n: "../i18n",
    },
  },
};
