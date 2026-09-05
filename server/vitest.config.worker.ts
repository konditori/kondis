import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })],
  resolve: {
    alias: {
      src: fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ['pg'],
          rolldownOptions: {
            external: [
              'crypto',
              'dns',
              'events',
              'fs',
              'net',
              'path',
              'stream',
              'string_decoder',
              'tls',
              'util',
              'util/types',
            ],
          },
        },
      },
    },
    include: ['test/worker/**/*.spec.ts'],
  },
});
