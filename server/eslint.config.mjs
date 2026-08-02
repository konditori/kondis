import js from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import eslintPluginImportX from 'eslint-plugin-import-x';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import typescriptEslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Relative imports are banned repo-wide so that every import is a stable `src/...`
 * specifier. The layer rules below depend on that, since they match on path prefixes.
 */
const noRelativeImports = {
  group: ['.*'],
  message: 'Relative imports are not allowed.',
};

/**
 * Architecture layers, highest to lowest. Dependencies may only point downward.
 *
 *   controllers  -> services
 *   services     -> repositories, domain, decorators, enum, types
 *   repositories -> db, config, domain, enum, types
 *   domain       -> (nothing: pure functions, no framework)
 *   db           -> (nothing)
 *
 * The job system would naturally violate this: `UploadService` triggers work that
 * `ActivityService` performs, and the queue sits below both. It stays acyclic because
 * `JobRepository` never imports a handler. It is handed the list of services by
 * `app.module.ts` and finds handlers by reflecting over `@OnJob` metadata, so a producer
 * depends on the job *name* and never on the code that services it.
 *
 * That only holds while `repositories/` cannot import `services/`, which is the rule
 * below and the reason it matters more than the others.
 */
const layerRules = [
  {
    name: 'domain must stay pure',
    files: ['src/domain/**/*.ts'],
    banned: [
      {
        group: [
          'src/services/**',
          'src/repositories/**',
          'src/controllers/**',
          'src/db/**',
          'src/config/**',
          'src/dtos/**',
          'src/decorators*',
          '@nestjs/*',
          '@nestjs/**',
        ],
        message:
          'domain/ must be pure: no framework, no I/O, no upward imports. It may only import other domain/ modules, src/enum, src/types and node builtins.',
      },
    ],
  },
  {
    name: 'repositories may not reach up',
    files: ['src/repositories/**/*.ts'],
    banned: [
      {
        group: ['src/services/**', 'src/controllers/**', 'src/dtos/**'],
        message:
          'repositories/ is below services/. Depend on db/, config/ and domain/ instead. JobRepository in particular must never import a service: handlers reach it through @OnJob discovery, and an import here would make the graph cyclic.',
      },
    ],
  },
  {
    name: 'db is the lowest layer',
    files: ['src/db/**/*.ts'],
    banned: [
      {
        group: ['src/services/**', 'src/repositories/**', 'src/controllers/**', 'src/domain/**'],
        message: 'db/ is the lowest layer and must not import anything above it.',
      },
    ],
  },
  {
    name: 'services may not import controllers or each other through the barrel',
    files: ['src/services/**/*.ts'],
    banned: [
      {
        group: ['src/controllers/**', 'src/services/index*'],
        message:
          'services/ sits below controllers/. Importing src/services/index from a service creates a cycle through the barrel; import the specific service instead.',
      },
    ],
  },
  {
    name: 'controllers go through services',
    files: ['src/controllers/**/*.ts'],
    banned: [
      {
        group: ['src/repositories/**', 'src/db/**'],
        message: 'controllers/ must go through services/, never straight to repositories or the database.',
      },
    ],
  },
];

export default typescriptEslint.config([
  eslintPluginUnicorn.configs.recommended,
  eslintPluginPrettierRecommended,
  js.configs.recommended,
  typescriptEslint.configs.recommended,
  {
    ignores: ['eslint.config.mjs', 'vitest.config.ts', 'src/open-api/**'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },

      parser: typescriptEslint.parser,
      ecmaVersion: 5,
      sourceType: 'module',

      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },

    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      'unicorn/name-replacements': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/no-null': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/prefer-event-target': 'off',
      'unicorn/no-thenable': 'off',
      'unicorn/import-style': 'off',
      'unicorn/prefer-structured-clone': 'off',
      'unicorn/no-for-loop': 'off',
      'unicorn/no-array-sort': 'off',
      'unicorn/no-unreadable-for-of-expression': 'off',
      'unicorn/no-break-in-nested-loop': 'off',
      'unicorn/no-top-level-assignment-in-function': 'off',
      'unicorn/prefer-uint8array-base64': 'off',
      'unicorn/max-nested-calls': 'off',
      'unicorn/no-declarations-before-early-exit': 'off',
      'unicorn/no-unreadable-object-destructuring': 'off',
      'unicorn/prefer-await': 'off',
      'unicorn/consistent-class-member-order': 'off',
      'unicorn/class-reference-in-static-methods': ['error', { preferThis: false, preferSuper: false }],
      'unicorn/no-unsafe-property-key': 'off',
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/no-computed-property-existence-check': 'off',
      'unicorn/no-non-function-verb-prefix': 'off',
      'unicorn/prefer-simple-condition-first': 'off',
      'unicorn/require-array-sort-compare': 'off',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      curly: 2,
      'prettier/prettier': 0,
      'object-shorthand': ['error', 'always'],
      'no-restricted-imports': ['error', { patterns: [noRelativeImports] }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Circular imports are a hard error. This is the rule that actually catches the
  // class of bug the layer conventions above are designed to prevent.
  {
    files: ['src/**/*.ts'],
    plugins: { 'import-x': eslintPluginImportX },
    settings: {
      // The resolver must understand the `src/*` path alias, otherwise every internal import
      // is unresolvable and no-cycle silently reports nothing.
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: path.join(__dirname, 'tsconfig.json') })],
      // Building the dependency graph means parsing *imported* files too, not just the one
      // being linted. Without this, no-cycle cannot see through .ts files and never fires.
      'import-x/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'],
      },
      'import-x/extensions': ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx'],
    },
    rules: {
      'import-x/no-cycle': ['error', { maxDepth: Infinity, ignoreExternal: true }],
      'import-x/no-self-import': 'error',
    },
  },

  // Layer boundaries. Each block re-declares the relative-import ban because
  // `no-restricted-imports` is replaced wholesale rather than merged.
  ...layerRules.map(({ files, banned }) => ({
    files,
    rules: {
      'no-restricted-imports': ['error', { patterns: [noRelativeImports, ...banned] }],
    },
  })),

  // Tests may reach across layers freely.
  {
    files: ['src/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noRelativeImports] }],
    },
  },

  // Declaration files describe the shape of third-party code we do not control, so design
  // rules about how that code *should* have been written do not apply.
  {
    files: ['src/**/*.d.ts'],
    rules: {
      'unicorn/no-static-only-class': 'off',
    },
  },
]);
