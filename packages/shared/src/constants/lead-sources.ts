/**
 * @fileoverview Orígenes de lead que el sistema escribe por su cuenta.
 *
 * Un lead nacido de una reserva describe a un comensal del local, no a una empresa que pueda
 * contratar a la agencia. El valor viaja guardado en la columna `source`, así que el backend y
 * la interfaz tienen que nombrarlo igual: de ahí que viva en el paquete compartido y no como
 * texto repetido a cada lado.
 */

/** Origen que marca a un lead como generado por el formulario público de reservas. */
export const RESERVATION_LEAD_SOURCE = 'espartanos_reservations'

/**
 * Valor con el que se guardó ese mismo origen antes del cambio de nombre.
 *
 * La migración reescribe las filas existentes; se conserva acá porque una instancia anterior
 * puede seguir escribiéndolo durante el despliegue, y porque los históricos exportados antes
 * del cambio lo siguen conteniendo.
 */
export const LEGACY_RESERVATION_LEAD_SOURCE = 'vitahub_reservations'

/** Todo valor que identifica a un lead nacido de una reserva, del vigente al anterior. */
export const RESERVATION_LEAD_SOURCES = [
  RESERVATION_LEAD_SOURCE,
  LEGACY_RESERVATION_LEAD_SOURCE,
] as const

/** Indica si un origen corresponde a una reserva, cualquiera sea la forma en que se guardó. */
export function isReservationLeadSource(source?: string | null): boolean {
  return source != null && (RESERVATION_LEAD_SOURCES as readonly string[]).includes(source)
}
