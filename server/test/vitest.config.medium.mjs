import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const globalSetup = ['test/medium/globalSetup.ts'];

export default defineConfig({
  // Vitest transforms with esbuild, which cannot emit `emitDecoratorMetadata`. Without it every
  // NestJS constructor injection silently resolves to `undefined`, so any test that boots the
  // real container fails with an unrelated-looking TypeError. Same reason `start:dev` uses
  // @swc-node/register rather than tsx.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: {
      src: resolve(serverRoot, 'src'),
      test: resolve(serverRoot, 'test'),
    },
  },
  test: {
    name: 'server:medium',
    root: serverRoot,
    include: ['test/medium/specs/**/*.spec.ts'],
    globalSetup,
    testTimeout: 30_000,
    pool: 'threads',
    maxWorkers: 1,
  },
});
