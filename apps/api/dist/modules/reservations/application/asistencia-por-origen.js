"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MUESTRA_MINIMA_POR_ORIGEN = void 0;
exports.asistenciaPorOrigen = asistenciaPorOrigen;
exports.MUESTRA_MINIMA_POR_ORIGEN = 10;
const LLEGO = 'attended';
function asistenciaPorOrigen(reservas) {
    const grupos = new Map();
    for (const reserva of reservas) {
        if (reserva.status !== LLEGO && reserva.status !== 'no_show')
            continue;
        const fuente = (reserva.utmSource ?? '').trim();
        const origen = fuente || (reserva.originDetected ? 'sin_identificar' : 'directo');
        const campana = (reserva.utmCampaign ?? '').trim() || null;
        const clave = `${origen}\u0000${campana ?? ''}`;
        const fila = grupos.get(clave) ?? {
            origen, campana, reservas: 0, llegaron: 0, noLlegaron: 0, comensales: 0,
            asistencia: null, confirmadasTrasRecordatorio: 0,
        };
        fila.reservas += 1;
        if (reserva.status === LLEGO) {
            fila.llegaron += 1;
            fila.comensales += Math.max(1, Math.trunc(reserva.partySize ?? 1));
            if (reserva.reminderSentAt && reserva.guestConfirmedAt)
                fila.confirmadasTrasRecordatorio += 1;
        }
        else {
            fila.noLlegaron += 1;
        }
        grupos.set(clave, fila);
    }
    for (const fila of grupos.values()) {
        fila.asistencia = fila.reservas >= exports.MUESTRA_MINIMA_POR_ORIGEN
            ? Math.round((fila.llegaron / fila.reservas) * 100)
            : null;
    }
    return [...grupos.values()].sort((uno, otro) => otro.comensales - uno.comensales
        || otro.reservas - uno.reservas
        || `${uno.origen}${uno.campana ?? ''}`.localeCompare(`${otro.origen}${otro.campana ?? ''}`));
}
