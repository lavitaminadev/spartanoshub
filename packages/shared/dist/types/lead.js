"use strict";
/**
 * @fileoverview Lead domain types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEAD_FIT_STATUSES = exports.LEAD_STATUSES = exports.LEAD_CLOSING_STAGES = exports.LEAD_RESERVATION_OUTCOMES = exports.LEAD_PIPELINE_STAGES = void 0;
/**
 * Etapas del pipeline comercial. El equipo las mueve a mano y son ordenadas:
 * el orden de este arreglo es el orden de las columnas del tablero.
 */
exports.LEAD_PIPELINE_STAGES = [
    'new',
    'contacted',
    'meeting_scheduled',
    'quote_sent',
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
exports.LEAD_FIT_STATUSES = ['qualified', 'review', 'discarded'];
//# sourceMappingURL=lead.js.map