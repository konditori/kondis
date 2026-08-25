import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";
const sidebars: SidebarsConfig = {
  guides: [
    "index",
    {
      type: "category",
      label: "Installation",
      items: [
        "install/requirements",
        "install/installation",
        "install/setup",
        "install/remote",
        "install/mobile",
      ],
    },
    {
      type: "category",
      label: "Usage",
      items: [
        "usage/importing",
        "usage/recording",
        "usage/activities",
        "usage/social",
      ],
    },
    {
      type: "category",
      label: "Operations",
      items: [
        "operations/backups",
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
