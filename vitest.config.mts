import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    setupFiles: ['tests/setup.ts'],
  },
  resolve: { alias: { '@': resolve(__dirname) } },
});
