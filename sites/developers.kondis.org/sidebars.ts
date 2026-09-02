import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";
const sidebars: SidebarsConfig = {
  developer: [
    "index",
    "overview",
    "local-development",
    "contributing",
    { type: "link", label: "User guides", href: "https://docs.kondis.org/" },
    { type: "link", label: "API reference", href: "https://api.kondis.org/" },
  ],
};
export default sidebars;
