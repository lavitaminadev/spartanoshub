import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Toda ruta debe tener alguna puerta de entrada.
 *
 * Una ruta se alcanza de tres maneras legítimas: una entrada de menú, un enlace desde otra
 * pantalla, o una redirección del propio sistema. Lo que no puede pasar es que exista solo en el
 * router: entonces la pantalla está construida, funciona, y nadie llega a ella salvo escribiendo
 * la dirección de memoria.
 *
 * Esta prueba busca cada ruta en el resto del código. No distingue de qué tipo es la puerta,
 * porque las tres sirven: `/sesiones` cuelga de la barra de cuenta y `/surveys/create` de un
 * botón, y ambas están tan conectadas como una entrada de menú.
 */

/** Rutas públicas y de sesión: se llega por dirección directa, correo o redirección. */
const ENTRADA_DIRECTA = new Set([
  '/', '/404', '/login', '/logout',
  '/forgot-password', '/reset-password', '/change-password', '/first-access',
  '/solicitudes',
  '/portal',
  // Meta devuelve el navegador acá tras autorizar. La puerta está en Meta, no en el código.
  '/integrations/meta/callback',
]);

function archivosFuente(directorio: string): string[] {
  return readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) return archivosFuente(ruta);
    return /\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada) ? [ruta] : [];
  });
}

describe('puertas de entrada a cada ruta', () => {
  it('ninguna ruta existe solo dentro del router', () => {
    const raiz = join(__dirname, '..');
    const archivos = archivosFuente(raiz);
    const router = archivos.find((archivo) => archivo.endsWith('router.tsx'))!;

    const rutas = [...new Set(
      [...readFileSync(router, 'utf8').matchAll(/path="(\/[a-z0-9/_-]*)"/g)].map(([, ruta]) => ruta),
    )].filter((ruta) => !ENTRADA_DIRECTA.has(ruta));

    // El propio router no cuenta como puerta: declarar la ruta no es poder llegar a ella.
    const resto = archivos
      .filter((archivo) => archivo !== router)
      .map((archivo) => readFileSync(archivo, 'utf8'))
      .join('\n');

    const sinPuerta = rutas.filter((ruta) => !resto.includes(`'${ruta}'`)
      && !resto.includes(`"${ruta}"`)
      && !resto.includes(`to="${ruta}`)
      && !resto.includes(`\`${ruta}`));

    // Sin esto la prueba pasaría igual si el recorrido dejara de encontrar el router.
    expect(rutas.length).toBeGreaterThan(20);
    expect(sinPuerta).toEqual([]);
  });
});
