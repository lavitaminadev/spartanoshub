/**
 * @fileoverview Lo que pierde el comensal si cancela su reserva, dicho con sus datos.
 *
 * La fecha y la hora se escriben en la zona del local, no en la del navegador: una reserva a las
 * 23:30 en Santiago ya es el día siguiente en UTC, y avisar que se pierde la mesa de otro día
 * es peor que no avisar.
 */

export interface DatosDeLaReserva {
  /** Cuántas personas van. */
  partySize: number;
  /** Cuándo empieza, en ISO y en UTC: `2026-11-13T21:59:00.000Z`. */
  startsAt: string;
  /** Zona del local: `America/Santiago`. */
  timezone: string;
}

/** «Pierdes tu mesa para 2 personas del viernes 13 de noviembre a las 18:59. …» */
export function consecuenciaDeCancelar({ partySize, startsAt, timezone }: DatosDeLaReserva): string {
  const fecha = new Date(startsAt);
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone })
      .formatToParts(fecha)
      .map((parte) => [parte.type, parte.value]),
  );
  const hora = fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone });
  const personas = `${partySize} persona${partySize === 1 ? '' : 's'}`;

  return `Pierdes tu mesa para ${personas} del ${partes.weekday} ${partes.day} de ${partes.month} a las ${hora}. Si después quieres ir, tendrás que reservar de nuevo.`;
}
