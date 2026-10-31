import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: { alias: { '@teach/domain': fileURLToPath(new URL('./app/domain/src/index.ts', import.meta.url)) } },
  test: {
    include: ['app/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30000, hookTimeout: 30000,
    coverage: {
      provider: 'v8', include: ['app/domain/src/**/*.ts', 'app/worker/src/**/*.ts'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
      reporter: ['text', 'json-summary', 'html']
    }
  }
});
