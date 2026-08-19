import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Ningún listado del front puede pedir más items de los que su endpoint acepta.
 *
 * `PaginationDto` del servidor rechaza `limit` sobre 100 con un 400, y la pantalla queda vacía
 * sin decir por qué: el error llega como fallo de red, no como aviso. El tablero de tratos pedía
 * 200 y no mostraba ningún trato en producción.
 *
 * `/audit` queda fuera porque no usa `PaginationDto`: recibe el parámetro suelto y lo topa en
 * 500 dentro del servicio, así que sus consultas mayores sí son válidas.
 */
const CAP_PAGINATION_DTO = 100;
const EXCEPCIONES = new Map<string, number>([['/audit', 500]]);

function archivosFuente(directorio: string): string[] {
  return readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) return archivosFuente(ruta);
    return /\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada) ? [ruta] : [];
  });
}

describe('tamaños de página pedidos por el front', () => {
  it('ningún listado supera el tope que acepta su endpoint', () => {
    const excesos: string[] = [];
    const revisados: string[] = [];

    for (const ruta of archivosFuente(join(__dirname, '..'))) {
      const contenido = readFileSync(ruta, 'utf8');
      for (const linea of contenido.split('\n')) {
        for (const [, ruta_api, valor] of linea.matchAll(/'([^']*?)\?(?:[^']*&)?(?:limit|pageSize)=(\d+)/g)) {
          const tope = EXCEPCIONES.get(ruta_api) ?? CAP_PAGINATION_DTO;
          revisados.push(`${ruta_api}=${valor}`);
          if (Number(valor) > tope) excesos.push(`${ruta_api} pide ${valor}, el tope es ${tope}`);
        }
      }
    }

    // Sin esto la prueba pasaría igual si el recorrido dejara de encontrar archivos.
    expect(revisados.length).toBeGreaterThan(3);
    expect(excesos).toEqual([]);
  });
});
