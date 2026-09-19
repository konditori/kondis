import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
const config: Config = {
  title: "Kondis",
  tagline: "Self-hosted, open source fitness tracker",
  favicon: "img/favicon.svg",
  url: "https://docs.kondis.org",
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
          exclude: ["dev/**"],
          routeBasePath: "/",
          showLastUpdateTime: true,
          editUrl:
            "https://github.com/konditori/kondis/tree/main/sites/docs.kondis.org/",
        },
        theme: { customCss: "./src/css/custom.css" },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    colorMode: {
      defaultMode: "light",
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: "Kondis Docs",
      logo: { alt: "Kondis", src: "img/favicon.svg" },
      items: [
        {
          href: "https://kondis.org/",
          label: "kondis.org",
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
        plain: { color: "#f5f2ed", backgroundColor: "#2d2b28" },
        styles: [
          {
            types: ["comment", "prolog", "doctype", "cdata"],
            style: { color: "#aaa39a" },
          },
          { types: ["punctuation", "operator"], style: { color: "#d8d4ce" } },
          {
            types: [
              "property",
              "tag",
              "boolean",
              "number",
              "constant",
              "symbol",
            ],
            style: { color: "#ffb16e" },
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
            style: { color: "#ffc18b" },
          },
          {
            types: ["atrule", "attr-value", "keyword"],
            style: { color: "#ff9b45" },
          },
          { types: ["function", "class-name"], style: { color: "#f6c28b" } },
        ],
      },
      darkTheme: {
        plain: { color: "#f5f2ed", backgroundColor: "#2d2b28" },
        styles: [],
      },
    },
  } satisfies Preset.ThemeConfig,
};
export default config;
