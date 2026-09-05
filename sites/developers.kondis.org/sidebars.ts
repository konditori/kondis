import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";
const sidebars: SidebarsConfig = {
  developer: [
    "index",
    "overview",
    {
      type: "category",
      label: "Deploying on Cloudflare",
      items: ["cloudflare/deployment", "cloudflare/authentication"],
    },
    "local-development",
    "contributing",
    { type: "link", label: "User guides", href: "https://docs.kondis.org/" },
    { type: "link", label: "API reference", href: "https://api.kondis.org/" },
  ],
};
export default sidebars;
