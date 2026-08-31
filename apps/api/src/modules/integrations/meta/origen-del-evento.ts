/**
 * Identificador interno del lead que originó un evento, leído de su `event_id`.
 *
 * Los identificadores de la cola viajan hasheados —el `external_id` guardado es un digest— así
 * que el `event_id` es el único sitio donde el UUID del lead sigue siendo legible. Se emite con
 * la forma `lead-<hecho>:<uuid>` desde `LeadStageChangedHandler`.
 *
 * Es deliberadamente estricto: solo reconoce esa forma exacta con un UUID válido. Un evento de
 * reservas, o cualquier otro que no nazca de un lead, devuelve `null` y queda fuera de toda
 * comprobación que dependa de esto.
 *
 * **Solo el UUID, nunca el nombre ni el correo.** Dos personas distintas pueden compartir nombre,
 * teléfono y campaña, y la misma persona puede entrar dos veces por dos campañas: cada entrada es
 * un lead con su propio identificador. Emparejar por cualquier otro dato haría que lo que se
 * decide sobre un lead alcanzara al de otra campaña.
 *
 * @param eventId - `event_id` estable de la fila de la cola.
 * @returns El UUID del lead, o `null` si el evento no proviene de uno.
 */
const EVENTO_DE_LEAD = /^lead-[a-z]+:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function leadDelEvento(eventId: string | null | undefined): string | null {
  const coincidencia = EVENTO_DE_LEAD.exec(String(eventId ?? ''));
  return coincidencia ? coincidencia[1].toLowerCase() : null;
}
