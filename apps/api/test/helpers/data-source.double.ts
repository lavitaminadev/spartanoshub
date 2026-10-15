import { vi } from 'vitest';

/**
 * Doble del `DataSource` que `ReservationsService` usa para las consultas sueltas.
 *
 * El servicio llama a `query` en una decena de sitios con SQL distinto —el nombre de quien
 * actuó, los datos legales de la empresa, si hay integración de Google, el registro de
 * auditoría— y casi siempre dentro de un `try` que sólo deja una línea en el log. Pasar `{}`
 * hacía que esas llamadas lanzaran «query is not a function» y que la rama se saltara entera: la
 * prueba pasaba igual, pero probaba menos de lo que creía, y una rotura de verdad escribía
 * exactamente el mismo mensaje.
 *
 * Responde por forma de consulta y no con un valor único, porque quien pregunta por un nombre
 * espera una fila con `name` y quien pregunta por los datos legales espera otras columnas:
 * devolver lo mismo a todos deja al servicio leyendo campos que no existen.
 *
 * El valor por defecto de cada forma es el que deja la regla en reposo —sin integración, sin
 * datos legales— para que una prueba que mira otra cosa no tenga que declarar nada.
 *
 * @param filasPorConsulta - Respuestas a medida: la clave es un trozo del SQL que basta para
 *   reconocerlo (`'FROM users'`, `'FROM clients'`), y gana la primera que calce.
 */
export function createDataSourceDouble(filasPorConsulta: Record<string, unknown[]> = {}) {
  const query = vi.fn(async (sql: string) => {
    for (const [fragmento, filas] of Object.entries(filasPorConsulta)) {
      if (sql.includes(fragmento)) return filas;
    }
    if (sql.includes('FROM users')) return [{ name: 'Equipo Espartanos' }];
    // Sin datos legales la aceptación sale con los de la agencia, que es el camino de siempre.
    if (sql.includes('FROM clients')) return [];
    // Sin integración de Google: el calendario del local no se toca.
    if (sql.includes('FROM integrations')) return [];
    // `INSERT INTO audit_logs` y cualquier otra escritura suelta no devuelven filas.
    return [];
  });
  return { query } as never;
}
