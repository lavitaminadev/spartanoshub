import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { META_DEDUPLICATED_EVENTS, META_SERVER_ONLY_EVENTS, metaEventId } from '@espartanos/shared';

/**
 * Meta une el evento del navegador con el del servidor solo si coinciden el nombre y el
 * `eventID`. Si no coinciden no falla nada: cuenta dos conversiones donde hubo una, el costo por
 * resultado aparece a la mitad del real, y la campaña se optimiza con cifras infladas. Nadie lo
 * nota hasta compararlo con la caja.
 *
 * El contrato ahora vive en `@espartanos/shared` y lo importan los dos lados, así que no puede
 * divergir. Esta prueba defiende esa propiedad: fija el formato y comprueba que nadie haya vuelto
 * a escribir a mano un identificador de deduplicación en ninguno de los dos proyectos.
 */
describe('deduplicación de eventos de Meta', () => {
  it('arma el identificador en el formato que ambos lados esperan', () => {
    expect(metaEventId(META_DEDUPLICATED_EVENTS.SCHEDULE, 'reserva-1')).toBe('schedule:reserva-1');
    expect(metaEventId(META_DEDUPLICATED_EVENTS.LEAD, 'resp-1')).toBe('lead:resp-1');
    expect(metaEventId(META_DEDUPLICATED_EVENTS.INITIATE_CHECKOUT, 'ev-1')).toBe('initiatecheckout:ev-1');
  });

  /**
   * `Reserva_Asistida` viaja solo por servidor: la asistencia la confirma el equipo en el local y
   * no hay navegador que pueda repetirla. Incluirlo acá invitaría a dispararlo desde el Pixel.
   */
  it('no declara como deduplicado un evento que solo manda el servidor', () => {
    expect(Object.values(META_DEDUPLICATED_EVENTS)).not.toContain('Reserva_Asistida');
  });

  it('ningún proyecto vuelve a escribir el identificador a mano', () => {
    const raices = [
      join(__dirname, '../../../src'),
      join(__dirname, '../../../../web/src'),
    ];

    const sospechosas: string[] = [];
    let revisados = 0;

    for (const raiz of raices) {
      for (const ruta of archivosFuente(raiz)) {
        revisados += 1;
        const contenido = readFileSync(ruta, 'utf8');
        const todos = [...Object.values(META_DEDUPLICATED_EVENTS), ...Object.values(META_SERVER_ONLY_EVENTS)];
        for (const evento of todos) {
          // Un identificador escrito a mano es el nombre en minúsculas seguido de dos puntos y
          // una interpolación. La función compartida no produce ese texto en el código fuente.
          const aMano = new RegExp(`['\`"]${evento.toLowerCase()}:\\$\\{`);
          if (aMano.test(contenido)) sospechosas.push(`${ruta}: ${evento}`);
        }
      }
    }

    // Sin esto la prueba pasaría igual si el recorrido dejara de encontrar archivos.
    expect(revisados).toBeGreaterThan(100);
    expect(sospechosas).toEqual([]);
    /*
     * Lee cada archivo de las dos aplicaciones, así que su costo crece con el proyecto y no con
     * lo que comprueba. El plazo por defecto —cinco segundos— se le quedó corto y empezó a
     * fallar por lentitud, que en una prueba de contenido se lee como si hubiera encontrado algo.
     */
  }, 30_000);
});

function archivosFuente(directorio: string): string[] {
  return readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) return archivosFuente(ruta);
    return /\.tsx?$/.test(entrada) ? [ruta] : [];
  });
}
