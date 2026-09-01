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
  ],
};
export default sidebars;
