import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the `src/*` path alias in tsconfig.json so unit tests can use the
      // same absolute-style imports the rest of the server uses.
      src: fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    name: 'server',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
