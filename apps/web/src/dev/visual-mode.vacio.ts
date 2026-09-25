/**
 * @fileoverview El modo visual, tal como queda en una compilación de producción: nada.
 *
 * `main.tsx` importa `./dev/visual-mode` por su efecto secundario —instalar el adaptador de
 * axios antes de que nadie construya la instancia—, y un `if (VISUAL_MODE)` dentro del módulo
 * no impide que el módulo entre al paquete: ejecuta código en su nivel superior, así que Rollup
 * no puede descartarlo y viajaba entero a producción, con su usuario sintético, sus rutas
 * simuladas y la función que lee `?rol=` de la dirección.
 *
 * `vite.config.ts` apunta ese import a este archivo cuando no se compila en modo visual. El
 * reemplazo ocurre al resolver, antes de empaquetar, así que el original no llega a leerse.
 */

/** Siempre falso fuera del modo visual. Se conserva para que el módulo exponga lo mismo. */
export const VISUAL_MODE = false;
