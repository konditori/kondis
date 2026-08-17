import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: [
    "node_modules/**",
    "**/.svelte-kit/**",
    "**/dist/**",
    "**/coverage/**",
    "**/*.spec.ts",
    "**/test/**",
    "tools/oxlint/anti-slop/**",
  ],
  plugins: ["eslint", "typescript", "import", "unicorn", "oxc"],
  jsPlugins: [{ name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" }],
  rules: {
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-runtime-typeof": "error",
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",
  },
  overrides: [
    {
      // XML parser output is decoded in these repositories. The generic XML tree is
      // necessarily represented as an untyped dictionary while it is being decoded.
      files: ["server/src/repositories/gpx.repository.ts", "server/src/repositories/tcx.repository.ts"],
      rules: {
        "anti-slop/no-runtime-typeof": "off",
        "anti-slop/no-unknown-parameters": "off",
        "anti-slop/no-unknown-returns": "off",
        "anti-slop/no-unsafe-dictionary-type": "off",
      },
    },
    {
      // These decorators are compatibility shims for TypeORM-style metadata APIs,
      // whose callback contract deliberately uses broad runtime values.
      files: ["server/src/schema/decorators.ts"],
      rules: {
        "anti-slop/no-chained-type-assertions": "off",
        "anti-slop/no-object-parameters": "off",
        "anti-slop/no-unknown-parameters": "off",
        "anti-slop/no-unknown-returns": "off",
      },
    },
    {
      // Nest's decorators deliver untrusted request values to these methods, which
      // immediately validate them with their colocated Zod schemas.
      files: ["server/src/controllers/auth.controller.ts", "server/src/controllers/user.controller.ts"],
      rules: {
        "anti-slop/no-unknown-parameters": "off",
      },
    },
    {
      // Nest's parameter-decorator and metadata APIs use broad framework-owned values.
      files: ["server/src/auth.ts"],
      rules: {
        "anti-slop/no-object-parameters": "off",
        "anti-slop/no-unknown-parameters": "off",
      },
    },
    {
      // pg-boss stores arbitrary job payloads and ModuleRef exposes service members
      // dynamically; this repository checks job metadata before invoking a handler.
      files: ["server/src/repositories/job.repository.ts"],
      rules: {
        "anti-slop/no-chained-type-assertions": "off",
        "anti-slop/no-known-value-widening": "off",
        "anti-slop/no-runtime-typeof": "off",
        "anti-slop/no-unknown-parameters": "off",
        "anti-slop/no-unknown-returns": "off",
        "anti-slop/no-unsafe-dictionary-type": "off",
      },
    },
    {
      // Prototype inspection is intentionally runtime-oriented startup plumbing.
      files: ["server/src/utils/misc.ts"],
      rules: {
        "anti-slop/no-object-parameters": "off",
        "anti-slop/no-runtime-typeof": "off",
        "anti-slop/no-unknown-parameters": "off",
      },
    },
    {
      // Cursor decoding validates its compact JSON representation inline.
      files: ["server/src/services/activity.service.ts"],
      rules: {
        "anti-slop/no-runtime-typeof": "off",
      },
    },
    {
      // fit-file-parser exposes dynamic message records that are normalized here.
      files: ["server/src/repositories/fit.repository.ts"],
      rules: {
        "anti-slop/no-unsafe-dictionary-type": "off",
      },
    },
    {
      // This CLI reads package-manager JSON whose schema belongs to pnpm/npm.
      files: ["server/src/bin/generate-third-party-notices.ts"],
      rules: {
        "anti-slop/no-known-value-widening": "off",
        "anti-slop/no-unknown-parameters": "off",
        "anti-slop/no-unsafe-dictionary-type": "off",
      },
    },
  ],
});
