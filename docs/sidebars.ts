import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";
const sidebars: SidebarsConfig = {
  guides: [
    "index",
    {
      type: "category",
      label: "Get started",
      items: [
        "getting-started/installation",
        "getting-started/first-run",
        "getting-started/configuration",
      ],
    },
    {
      type: "category",
      label: "Using Kondis",
      items: [
        "using-kondis/activities",
        "using-kondis/importing",
        "using-kondis/recording",
        "using-kondis/social",
      ],
    },
    {
      type: "category",
      label: "Operations",
      items: [
        "operations/deployment",
        "operations/backups",
        "operations/troubleshooting",
      ],
    },
  ],
  developers: [
    "developers/overview",
    "developers/local-development",
    "developers/architecture",
    "developers/api",
    "developers/contributing",
    "developers/cursed-knowledge",
  ],
};
export default sidebars;
