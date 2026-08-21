"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.identificadorExterno = identificadorExterno;
const IDENTIFICADORES_GLOBALES = new Set(['meta_lead_ads']);
function identificadorExterno(source, idExterno) {
    if (!idExterno)
        return undefined;
    return IDENTIFICADORES_GLOBALES.has(source) ? idExterno : `${source}:${idExterno}`;
}
