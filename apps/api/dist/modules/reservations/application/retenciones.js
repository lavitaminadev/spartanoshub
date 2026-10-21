"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOPE_RETENCIONES_POR_ORIGEN = void 0;
exports.huellaDeOrigen = huellaDeOrigen;
const node_crypto_1 = require("node:crypto");
exports.TOPE_RETENCIONES_POR_ORIGEN = 6;
function huellaDeOrigen(ip) {
    const limpia = (ip ?? '').trim();
    return limpia ? (0, node_crypto_1.createHash)('sha256').update(`retencion:${limpia}`).digest('hex').slice(0, 32) : undefined;
}
