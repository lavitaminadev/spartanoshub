import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Toda bandeja de salida debe tener quien la vacíe desde dentro.
 *
 * Una cola sin trabajo programado no falla: acepta lo que se le encola, no lo envía nunca, y no
 * se queja. Pasó con las conversiones de Google, que tenían endpoint de cron externo pero nadie
 * las procesaba desde la aplicación. Las de Meta salían y las de Google no, y la diferencia solo
 * aparece al comparar campañas semanas después.
 *
 * Depender de un cron del hosting es legítimo, pero no puede ser la única vía: si esa
 * configuración se pierde al migrar de servidor, la cola deja de vaciarse en silencio.
 */
const RAIZ = join(__dirname, '../../../src');

function archivosFuente(directorio: string): string[] {
  return readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) return archivosFuente(ruta);
    return entrada.endsWith('.ts') && !entrada.endsWith('.spec.ts') ? [ruta] : [];
  });
}

describe('bandejas de salida', () => {
  it('cada procesador de cola está programado en el planificador', () => {
    const procesadores = archivosFuente(RAIZ)
      .filter((ruta) => {
        const contenido = readFileSync(ruta, 'utf8');
        // Quienes extienden la base son, por definición, colas que hay que vaciar.
        return /extends\s+OutboxProcessor\b/.test(contenido);
      })
      .map((ruta) => readFileSync(ruta, 'utf8').match(/export class (\w+)/)?.[1])
      .filter((nombre): nombre is string => Boolean(nombre));

    const planificador = readFileSync(join(RAIZ, 'core/jobs/job-scheduler.service.ts'), 'utf8');

    /*
     * Se comprueba la programación real, no que el nombre aparezca.
     *
     * Inyectar el servicio y no programarlo es exactamente el fallo que se persigue, así que
     * buscar la clase en el archivo daría por buena la situación que se quiere evitar: el
     * constructor la nombra igual. Primero se traduce la clase al campo con que se inyecta, y
     * luego se exige que ese campo aparezca dentro de un `schedule(...)` vaciando la cola.
     */
    const programados = new Set(
      planificador.split('\n')
        .filter((linea) => linea.includes('schedule('))
        .map((linea) => linea.match(/this\.(\w+)\.processPending/)?.[1])
        .filter((campo): campo is string => Boolean(campo)),
    );

    const sinProgramar = procesadores.filter((clase) => {
      const campo = planificador.match(new RegExp(`(\\w+):\\s*${clase}\\b`))?.[1];
      return !campo || !programados.has(campo);
    });

    // Sin esto la prueba pasaría igual si el recorrido dejara de encontrar procesadores.
    expect(procesadores.length).toBeGreaterThanOrEqual(2);
    expect(sinProgramar).toEqual([]);
    /*
     * Recorre los archivos de la aplicación, así que su costo crece con el proyecto y no con lo
     * que comprueba. El plazo por defecto se le quedó corto y empezó a fallar por lentitud, que
     * en una prueba de contenido se lee como si hubiera encontrado un procesador sin programar.
     */
  }, 30_000);
});
