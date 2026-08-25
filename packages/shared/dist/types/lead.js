"use strict";
/**
 * @fileoverview Lead domain types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEAD_DISCARD_REASONS = exports.LEAD_TRAFFIC_LIGHTS = exports.LEAD_FIT_STATUSES = exports.LEAD_STATUSES_BY_DOMAIN = exports.LEAD_STATUSES = exports.LEAD_CLOSING_STAGES = exports.LEAD_RESERVATION_OUTCOMES = exports.LEAD_PIPELINE_STAGES = void 0;
/**
 * Etapas del pipeline comercial. El equipo las mueve a mano y son ordenadas:
 * el orden de este arreglo es el orden de las columnas del tablero.
 */
exports.LEAD_PIPELINE_STAGES = [
    'new',
    'contacted',
    'quote_sent',
    'meeting_scheduled',
    // Se agendo la visita y ademas ocurrio. Son dos hechos distintos y el equipo los trabaja
    // distinto: uno espera a que llegue la fecha, el otro espera una respuesta.
    'visited',
    'negotiation',
];
/**
 * Resultados del ciclo de reserva. Los escribe el sistema, no el equipo:
 * `reserved` al crearse la reserva y `attended` / `no_show` al registrar la
 * asistencia. No son etapas del pipeline y no se arrastran.
 */
exports.LEAD_RESERVATION_OUTCOMES = [
    'reserved',
    'attended',
    'no_show',
];
/**
 * Cierres del pipeline comercial.
 */
exports.LEAD_CLOSING_STAGES = ['won', 'lost'];
/**
 * Universo completo de estados aceptados. Es la unica fuente de verdad: el enum
 * del backend y las columnas del tablero derivan de aca para que no se
 * desincronicen.
 */
exports.LEAD_STATUSES = [
    ...exports.LEAD_PIPELINE_STAGES,
    ...exports.LEAD_RESERVATION_OUTCOMES,
    ...exports.LEAD_CLOSING_STAGES,
];
/**
 * Que estados admite cada embudo, en el orden en que se recorren.
 *
 * **Es la fuente unica.** El enum de la API, el reparto por dominio, las columnas del tablero y
 * la paleta de estados derivan de aca. Estuvieron declarados por separado en cinco sitios, y esa
 * duplicacion costo dos fallos silenciosos: faltaba 'visited' en el embudo comercial y 'lost' en
 * el de campana, asi que los leads en esos estados no tenian columna donde dibujarse. No fallaba
 * nada; simplemente desaparecian de la pantalla.
 *
 * Los dos embudos comparten 'new' y 'lost' a proposito: todo lead nace nuevo, y tanto una venta
 * que no se gano como una visita que no ocurrio se cierran igual.
 */
exports.LEAD_STATUSES_BY_DOMAIN = {
    commercial: [...exports.LEAD_PIPELINE_STAGES, ...exports.LEAD_CLOSING_STAGES],
    audience: ['new', ...exports.LEAD_RESERVATION_OUTCOMES, 'lost'],
};
exports.LEAD_FIT_STATUSES = ['qualified', 'review', 'unqualified'];
/** Prioridad manual. No se deriva del puntaje automático. */
exports.LEAD_TRAFFIC_LIGHTS = ['green', 'yellow', 'red'];
/** Catálogo de descarte usado por el flujo comercial de referencia MMT. */
exports.LEAD_DISCARD_REASONS = [
    'Precio fuera de presupuesto',
    'Sin financiamiento / no calificó crédito',
    'Compró en otro proyecto',
    'Nunca respondió',
    'Datos de contacto erróneos',
    'Ubicación no le acomoda',
    'Solo consultaba (sin intención)',
    'No es el perfil buscado',
    'Otro',
];
//# sourceMappingURL=lead.js.map