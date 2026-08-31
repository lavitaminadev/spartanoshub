"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sinCredenciales = sinCredenciales;
const TOKEN_DE_META = /EAA[A-Za-z0-9_-]{60,}/g;
const OCULTO = '[token oculto]';
function sinCredenciales(texto) {
    return String(texto ?? '').replace(TOKEN_DE_META, OCULTO);
}
