import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Ninguna clase de contenedor puede tener dos dueños en dos hojas distintas.
 *
 * `.notification-center` la definían a la vez la campanita de la barra lateral —`position:
 * relative` dentro de su fila— y la pila de avisos flotantes —`position: fixed` arriba a la
 * derecha, con `pointer-events: none`—. Cuál ganaba dependía del orden de carga: la campanita
 * aparecía sobre el logotipo y sin responder al puntero según la compilación.
 *
 * Se comprueba sobre el texto de las hojas y no sobre la pantalla montada porque el fallo vive
 * en la cascada: las dos reglas son válidas por separado y solo se estorban juntas.
 */
const RAIZ = join(__dirname, '..');

/** Lo que puede seguir al nombre de una clase en un selector, sin dejar de ser esa clase. */
const CIERRES = [' ', '{', '.', ':', ',', '>', '[', '\t'];

function hojas(directorio: string): string[] {
  return readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) return hojas(ruta);
    return ruta.endsWith('.css') ? [ruta] : [];
  });
}

/**
 * Si la hoja abre un bloque con esa clase.
 *
 * Se mira línea a línea y sin expresiones regulares a propósito: mencionarla en un comentario
 * —como hace la hoja de los avisos flotantes para explicar por qué ya no la usa— no es
 * declararla, y la diferencia está en que el selector abre llave.
 */
function declara(contenido: string, clase: string): boolean {
  return contenido.split('\n').some((linea) => {
    const texto = linea.trim();
    if (!texto.startsWith(`.${clase}`) || !texto.includes('{')) return false;
    const siguiente = texto.charAt(clase.length + 1);
    return siguiente === '' || CIERRES.includes(siguiente);
  });
}

describe('hojas de estilo', () => {
  // Solo contenedores: las clases de detalle se comparten a propósito entre pantallas.
  const vigiladas = ['notification-center', 'toast-stack', 'sidebar-footer-actions'];

  it('no declara la misma clase de contenedor en dos archivos', () => {
    const duenos = new Map<string, string[]>();

    for (const ruta of hojas(RAIZ)) {
      const contenido = readFileSync(ruta, 'utf8');
      for (const clase of vigiladas) {
        if (declara(contenido, clase)) {
          duenos.set(clase, [...(duenos.get(clase) ?? []), ruta.slice(RAIZ.length + 1)]);
        }
      }
    }

    const repetidas = [...duenos.entries()].filter(([, archivos]) => archivos.length > 1);
    expect(repetidas).toEqual([]);
  });

  // Sin esto la prueba anterior pasa aunque `declara` deje de reconocer nada, que es
  // exactamente como se coló la primera versión.
  it('reconoce una declaración cuando la hay', () => {
    expect(declara('.notification-center { position: relative; }', 'notification-center')).toBe(true);
    expect(declara('.notification-center.en-cabecera { display: none; }', 'notification-center')).toBe(true);
    expect(declara('  .toast-stack {\n  position: fixed;\n}', 'toast-stack')).toBe(true);
    expect(declara('/* la clase .toast-stack ya no se usa */', 'toast-stack')).toBe(false);
    expect(declara('.notification-centered { color: red; }', 'notification-center')).toBe(false);
  });
});
