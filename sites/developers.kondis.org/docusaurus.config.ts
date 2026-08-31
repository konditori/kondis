import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
const config: Config = {
  title: "Kondis Developers",
  tagline: "Build with and contribute to Kondis",
  favicon: "img/favicon.svg",
  url: "https://developers.kondis.org",
  baseUrl: "/",
  organizationName: "konditori",
  projectName: "kondis",
  onBrokenLinks: "throw",
  markdown: { hooks: { onBrokenMarkdownLinks: "warn" } },
  i18n: { defaultLocale: "en", locales: ["en"] },
  presets: [
    [
      "@docusaurus/preset-classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "/",
          showLastUpdateTime: true,
          editUrl:
            "https://github.com/konditori/kondis/tree/main/sites/developers.kondis.org/",
        },
        theme: { customCss: "./src/css/custom.css" },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    navbar: {
      title: "Kondis Developers",
      logo: { alt: "Kondis", src: "img/logo.svg" },
      items: [
        {
          href: "https://docs.kondis.org/",
          label: "User docs",
          position: "right",
        },
        {
          href: "https://api.kondis.org/",
          label: "API",
          position: "right",
        },
        {
          href: "https://github.com/konditori/kondis",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    prism: {
      theme: {
        plain: { color: "#e7e8f0", backgroundColor: "#292a3a" },
        styles: [
          {
            types: ["comment", "prolog", "doctype", "cdata"],
            style: { color: "#7180b4" },
          },
          { types: ["punctuation", "operator"], style: { color: "#b7bad0" } },
          {
            types: [
              "property",
              "tag",
              "boolean",
              "number",
              "constant",
              "symbol",
            ],
            style: { color: "#c6a0f6" },
          },
          {
            types: [
              "selector",
              "attr-name",
              "string",
              "char",
              "builtin",
              "inserted",
            ],
            style: { color: "#a6da95" },
          },
          {
            types: ["atrule", "attr-value", "keyword"],
            style: { color: "#91b4f2" },
          },
          { types: ["function", "class-name"], style: { color: "#f5c2a7" } },
        ],
      },
      darkTheme: {
        plain: { color: "#e7e8f0", backgroundColor: "#292a3a" },
        styles: [],
      },
    },
  } satisfies Preset.ThemeConfig,
};
export default config;
