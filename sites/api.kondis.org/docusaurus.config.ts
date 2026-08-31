import type { Config } from "@docusaurus/types";
import type * as Preset from "docusaurus-preset-openapi";

const config: Config = {
  title: "Kondis API",
  tagline: "Kondis API documentation",
  favicon: "img/favicon.svg",
  url: "https://api.kondis.org",
  baseUrl: "/",
  organizationName: "konditori",
  projectName: "kondis",
  onBrokenLinks: "throw",
  markdown: { hooks: { onBrokenMarkdownLinks: "warn" } },
  i18n: { defaultLocale: "en", locales: ["en"] },
  presets: [
    [
      "docusaurus-preset-openapi",
      {
        docs: false,
        blog: false,
        api: {
          path: "../../open-api/kondis-openapi-specs.json",
          routeBasePath: "/",
          sidebarCollapsible: true,
          sidebarCollapsed: false,
        },
        theme: { customCss: "./src/css/custom.css" },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    navbar: {
      title: "Kondis API",
      logo: { alt: "Kondis logo", src: "img/logo.svg" },
      items: [
        {
          href: "https://developers.kondis.org",
          label: "Developers",
          position: "right",
        },
        {
          href: "https://docs.kondis.org",
          label: "User docs",
          position: "right",
        },
        {
          href: "https://github.com/konditori/kondis",
          label: "GitHub",
          position: "right",
        },
      ],
    },
  },
};

export default config;
