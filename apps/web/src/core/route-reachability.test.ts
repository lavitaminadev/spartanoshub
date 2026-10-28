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
 * Esta prueba busca cada ruta como destino de un enlace real en el resto del código. No distingue
 * de qué tipo es la puerta, porque las tres sirven: `/sesiones` cuelga de la barra de cuenta y
 * `/surveys/create` de un botón, y ambas están tan conectadas como una entrada de menú.
 */

/** Rutas públicas y de sesión: se llega por dirección directa, correo o redirección. */
const ENTRADA_DIRECTA = new Set([
  '/', '/404', '/login', '/logout',
  '/forgot-password', '/reset-password', '/change-password', '/first-access',
  '/solicitudes',
  // Índice de documentos legales: se enlaza desde fuera (sitio, correos) y abre la política de privacidad.
  '/legal',
  '/portal',
  // Meta devuelve el navegador acá tras autorizar. La puerta está en Meta, no en el código.
  '/integrations/meta/callback',
]);

/**
 * Rutas que hoy existen sólo en el router, sin menú ni enlace. Están declaradas aquí para que la
 * prueba cubra lo nuevo sin esconder lo viejo: decidir si se enlazan o se retiran no es de esta
 * prueba. Cuando una se conecte (o se borre) hay que quitarla de la lista; la prueba falla si
 * la lista queda con rutas que ya tienen puerta.
 */
const SIN_ENTRADA_CONOCIDA = new Set([
  '/crm/pipeline',
  '/crm/contacts',
  '/crm/interactions',
  '/reservations/manage',
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

    // La entrada de menú real vive en el `navigation` de cada feature.manifest.ts.
    const manifiestos = archivos
      .filter((archivo) => archivo.endsWith('feature.manifest.ts'))
      .map((archivo) => readFileSync(archivo, 'utf8'))
      .join('\n');
    // Ni el router (declarar la ruta no es poder llegar a ella) ni el registro de navegación
    // (lista rutas y permisos, no enlaces) cuentan como puerta.
    const resto = archivos
      .filter((archivo) => archivo !== router && !archivo.endsWith('navigation.registry.ts'))
      .map((archivo) => readFileSync(archivo, 'utf8'))
      .join('\n');

    /*
     * Los bloques `navigation: [...]` de los manifiestos, delimitados contando corchetes.
     *
     * Hacía falta porque un manifiesto puede declarar varias entradas, y cada una lleva su
     * `roles: [...]`: una expresión que no cruce un `]` ve la primera entrada y ninguna más, así
     * que una ruta con menú propio en la segunda se reportaba como ruta sin puerta. Se acota al
     * bloque de navegación a propósito: un `path:` de `routes:` declara la ruta, que es justo lo
     * que esta prueba no acepta como entrada.
     */
    const navegacionDeLosManifiestos = [...manifiestos.matchAll(/navigation:\s*\[/g)].map((coincidencia) => {
      const desde = coincidencia.index! + coincidencia[0].length;
      let profundidad = 1;
      let i = desde;
      while (i < manifiestos.length && profundidad > 0) {
        if (manifiestos[i] === '[') profundidad++;
        else if (manifiestos[i] === ']') profundidad--;
        i++;
      }
      return manifiestos.slice(desde, i);
    }).join('\n');

    // Sólo cuenta el destino de un enlace real: `to`, `href` o `navigate`. Una llamada a la API
    // que comparte prefijo con la ruta (`api.get('/crm/contacts')`) no lleva a nadie a la pantalla.
    const escapar = (ruta: string) => ruta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tieneEnlace = (ruta: string) => new RegExp(
      `(?:\\b(?:to|href)\\s*[=:]\\s*\\{?\\s*|navigate\\(\\s*)['"\`]${escapar(ruta)}(?![\\w/-])`,
    ).test(resto)
      || new RegExp(`path:\\s*['"\`]${escapar(ruta)}['"\`]`).test(navegacionDeLosManifiestos);
    const sinPuerta = rutas.filter((ruta) => !tieneEnlace(ruta));
    const nuevas = sinPuerta.filter((ruta) => !SIN_ENTRADA_CONOCIDA.has(ruta));
    const yaConectadas = [...SIN_ENTRADA_CONOCIDA].filter((ruta) => !sinPuerta.includes(ruta));

    // Sin esto la prueba pasaría igual si el recorrido dejara de encontrar el router.
    expect(rutas.length).toBeGreaterThan(20);
    expect(nuevas).toEqual([]);
    expect(yaConectadas).toEqual([]);
  });
});
