"use strict";
/**
 * @fileoverview Orígenes de lead que el sistema escribe por su cuenta.
 *
 * Un lead nacido de una reserva describe a un comensal del local, no a una empresa que pueda
 * contratar a la agencia. El valor viaja guardado en la columna `source`, así que el backend y
 * la interfaz tienen que nombrarlo igual: de ahí que viva en el paquete compartido y no como
 * texto repetido a cada lado.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVATION_LEAD_SOURCES = exports.LEGACY_RESERVATION_LEAD_SOURCE = exports.RESERVATION_LEAD_SOURCE = void 0;
exports.isReservationLeadSource = isReservationLeadSource;
/** Origen que marca a un lead como generado por el formulario público de reservas. */
exports.RESERVATION_LEAD_SOURCE = 'espartanos_reservations';
/**
 * Valor con el que se guardó ese mismo origen antes del cambio de nombre.
 *
 * La migración reescribe las filas existentes; se conserva acá porque una instancia anterior
 * puede seguir escribiéndolo durante el despliegue, y porque los históricos exportados antes
 * del cambio lo siguen conteniendo.
 */
exports.LEGACY_RESERVATION_LEAD_SOURCE = 'vitahub_reservations';
/** Todo valor que identifica a un lead nacido de una reserva, del vigente al anterior. */
exports.RESERVATION_LEAD_SOURCES = [
    exports.RESERVATION_LEAD_SOURCE,
    exports.LEGACY_RESERVATION_LEAD_SOURCE,
];
/** Indica si un origen corresponde a una reserva, cualquiera sea la forma en que se guardó. */
function isReservationLeadSource(source) {
    return source != null && exports.RESERVATION_LEAD_SOURCES.includes(source);
}
//# sourceMappingURL=lead-sources.js.map