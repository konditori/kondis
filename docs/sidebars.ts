import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";
const sidebars: SidebarsConfig = {
  guides: [
    "index",
    {
      type: "category",
      label: "Install",
      items: [
        "install/requirements",
        "install/installation",
        "install/first-run",
        "install/configuration",
      ],
    },
    {
      type: "category",
      label: "Usage",
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
    {
      type: "category",
      label: "API",
      items: ["api"],
    },
    {
      type: "category",
      label: "Development",
      items: ["developer/overview"],
    },
  ],
  developer: [
    "developer/overview",
    "developer/local-development",
    "developer/architecture",
    "developer/contributing",
    "developer/cursed-knowledge",
  ],
};
export default sidebars;
