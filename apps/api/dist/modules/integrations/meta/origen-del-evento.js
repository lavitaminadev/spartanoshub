"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadDelEvento = leadDelEvento;
const EVENTO_DE_LEAD = /^lead-[a-z]+:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
function leadDelEvento(eventId) {
    const coincidencia = EVENTO_DE_LEAD.exec(String(eventId ?? ''));
    return coincidencia ? coincidencia[1].toLowerCase() : null;
}
