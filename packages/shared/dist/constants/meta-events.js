"use strict";
/**
 * @fileoverview Contrato de deduplicación con Meta, compartido por el navegador y el servidor.
 *
 * Cada conversión se envía dos veces a propósito: el Pixel la manda desde el navegador y
 * Conversions API la manda desde el servidor. Meta las une en una sola **si y solo si** coinciden
 * el nombre del evento y su `eventID`. Si no coinciden, no falla nada: Meta cuenta dos
 * conversiones donde hubo una, el costo por resultado aparece a la mitad del real, y la campaña
 * se optimiza con cifras infladas. Nadie lo nota hasta que se compara con la caja.
 *
 * Ese contrato vivía escrito a mano en los dos lados. Acá deja de poder divergir: renombrar un
 * evento o cambiar el formato del identificador se propaga a ambos, y quien lo intente solo en
 * uno rompe la compilación en vez de romper la medición.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_SERVER_ONLY_EVENTS = exports.META_DEDUPLICATED_EVENTS = void 0;
exports.metaEventId = metaEventId;
/**
 * Eventos que se envían por los dos canales y por lo tanto hay que deduplicar.
 *
 * `Reserva_Asistida` no está acá a propósito: la asistencia la confirma el equipo en el local,
 * viaja solo por servidor como `physical_store`, y no hay navegador que pueda repetirla.
 */
exports.META_DEDUPLICATED_EVENTS = {
    /** Alguien empezó a llenar el formulario. Es el paso intermedio del embudo. */
    INITIATE_CHECKOUT: 'InitiateCheckout',
    /** Reserva creada. */
    SCHEDULE: 'Schedule',
    /** Respuesta a una encuesta pública. */
    LEAD: 'Lead',
};
/**
 * Eventos que solo puede emitir el servidor.
 *
 * No se deduplican porque no hay navegador que los repita, pero su identificador se arma igual:
 * la bandeja de reservas consulta por él para mostrar si la conversión salió, y ese lector se
 * rompería en silencio —mostrando «desconocido» para todo— si el formato cambiara solo de un lado.
 */
exports.META_SERVER_ONLY_EVENTS = {
    /** Asistencia confirmada por el equipo en el local. */
    RESERVA_ASISTIDA: 'Reserva_Asistida',
};
/**
 * Identificador con que Meta une el evento del navegador y el del servidor.
 *
 * @param eventName - Nombre tal como se envía a Meta.
 * @param subjectId - Identificador del registro que originó el evento: la reserva, la respuesta
 *   de encuesta o el evento de formulario. Debe ser **el mismo** que ve el navegador; por eso los
 *   endpoints públicos devuelven el registro creado en vez de solo confirmar.
 */
function metaEventId(eventName, subjectId) {
    return `${eventName.toLowerCase()}:${subjectId}`;
}
//# sourceMappingURL=meta-events.js.map