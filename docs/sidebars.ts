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
      label: "Development",
      items: ["dev/overview",
    "dev/local-development",
    "dev/architecture",
    "dev/contributing",
    "dev/cursed-knowledge",
    "dev/api",

      ],
    },
  ],
  dev: [
    "dev/overview",
    "dev/local-development",
    "dev/architecture",
    "dev/contributing",
    "dev/cursed-knowledge",
    "dev/api",
  ],
};
export default sidebars;
