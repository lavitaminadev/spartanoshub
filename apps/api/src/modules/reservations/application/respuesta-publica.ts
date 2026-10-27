import type { Reservation } from '../domain/reservation.entity';

/**
 * Lo que el flujo público devuelve de una reserva: una lista cerrada de campos.
 *
 * Es la misma en la primera respuesta y en la repetición idempotente. Devolver la fila entera
 * llevaría la nota interna, la IP, los identificadores de anuncio y el resto de lo que el equipo
 * guarda de la reserva a quien sólo tiene la clave de idempotencia.
 */
export function respuestaPublicaDeReserva(booking: Reservation, managementToken?: string) {
  return {
    id: booking.id,
    referenceCode: booking.referenceCode,
    status: booking.status,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    partySize: booking.partySize,
    couponCode: booking.couponCode ?? undefined,
    createdAt: booking.createdAt,
    managementToken,
  };
}
