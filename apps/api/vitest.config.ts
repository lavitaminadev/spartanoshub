import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Las de extremo a extremo van en su propia configuración: necesitan una base viva y
    // tardan segundos. Ver `vitest.e2e.config.ts` y `npm run test:e2e`.
    include: ['test/**/*.spec.ts'],
    exclude: ['test/e2e/**'],
    clearMocks: true,
  },
});
