/**
 * @fileoverview Hasta cuándo una mesa cuenta como ocupada.
 *
 * La hora de fin de una reserva es una previsión, no un hecho: nadie le pregunta a la mesa a qué
 * hora se va. Mientras la ocupación se calculó con esa previsión, al llegar la hora prevista la
 * mesa quedaba libre en el sistema aunque la gente siguiera sentada, y el equipo podía aceptar
 * una reserva encima de una mesa que no existía.
 *
 * Ocupada quiere decir: alguien llegó y todavía no se ha ido. Se libera cuando el equipo marca
 * la salida —el botón «Se retiró»— o cuando el local cierra y la tarea de cierre la salda. Una
 * reserva que nunca llegó a marcarse como asistida sigue rigiéndose por su hora prevista.
 */

/**
 * Condición SQL de solapamiento que respeta la ocupación real.
 *
 * Se escribe una vez y se usa en todas las consultas de cupo: si cada una tuviera su propia
 * versión, bastaría con olvidar una para volver a aceptar reservas sobre una mesa ocupada.
 *
 * @param alias - Alias de la tabla de reservas en la consulta.
 * @returns Fragmento para el `WHERE`, con los parámetros `startsAt`, `endsAt` y `ahoraOcupacion`.
 */
export function condicionDeSolape(alias: string): string {
  return `${alias}.starts_at < :endsAt AND (CASE
      WHEN ${alias}.status = 'attended' AND ${alias}.left_at IS NULL THEN GREATEST(${alias}.ends_at, :ahoraOcupacion)
      ELSE ${alias}.ends_at
    END) > :startsAt`;
}
