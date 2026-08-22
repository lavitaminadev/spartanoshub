import { defineConfig } from 'vitest/config';

/**
 * Configuración de las pruebas de extremo a extremo.
 *
 * Van aparte de las unitarias porque necesitan una base MariaDB viva y tardan segundos, no
 * milisegundos: mezclarlas haría que la suite rápida —la que se corre en cada cambio— dependiera
 * de tener la base levantada.
 *
 * Un solo hilo y sin paralelismo: todas comparten la misma base y se vacían las tablas al
 * empezar, así que dos ficheros a la vez se pisarían los datos.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/e2e/**/*.e2e.spec.ts'],
    setupFiles: ['test/e2e/util/entorno.ts'],
    clearMocks: true,
    fileParallelism: false,
    hookTimeout: 180_000,
    testTimeout: 60_000,
  },
});
