/**
 * La fecha con la que se abre «Agendar visita».
 *
 * Vive aparte del panel para poder probarla: el formato que acepta un campo de fecha y hora es
 * local y sin zona, así que construirlo desde una fecha en UTC adelanta o atrasa la propuesta
 * según dónde esté quien la mira.
 */

/**
 * Propone el siguiente día hábil a las 10:00.
 *
 * Salta sábado y domingo porque una visita agendada en fin de semana es casi siempre un
 * descuido: la propuesta se corrige a mano, y corregir de lunes a martes cuesta menos que
 * descubrir el sábado cuando ya nadie fue.
 *
 * @param desde Momento a partir del cual proponer. Por defecto, ahora.
 * @returns Texto `AAAA-MM-DDTHH:MM` en hora local, listo para un `datetime-local`.
 */
export function proximaFechaSugerida(desde: Date = new Date()): string {
  const cuando = new Date(desde);
  do {
    cuando.setDate(cuando.getDate() + 1);
  } while ([0, 6].includes(cuando.getDay()));
  cuando.setHours(10, 0, 0, 0);

  const dosDigitos = (valor: number) => String(valor).padStart(2, '0');
  return `${cuando.getFullYear()}-${dosDigitos(cuando.getMonth() + 1)}-${dosDigitos(cuando.getDate())}`
    + `T${dosDigitos(cuando.getHours())}:${dosDigitos(cuando.getMinutes())}`;
}
