"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.respuestaPublicaDeReserva = respuestaPublicaDeReserva;
function respuestaPublicaDeReserva(booking, managementToken) {
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
