"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yaEstaHasheado = yaEstaHasheado;
exports.normalizarCorreo = normalizarCorreo;
exports.normalizarTelefono = normalizarTelefono;
exports.normalizarNombre = normalizarNombre;
exports.normalizarGeografia = normalizarGeografia;
exports.hashearTodos = hashearTodos;
exports.prepararIdentificadores = prepararIdentificadores;
exports.parametroSinHashear = parametroSinHashear;
const node_crypto_1 = require("node:crypto");
const geo_inference_1 = require("../../../shared/geo-inference");
const phone_1 = require("../../../shared/phone");
const SHA256_HEX = /^[a-f0-9]{64}$/i;
function yaEstaHasheado(valor) {
    return SHA256_HEX.test(valor.trim());
}
function normalizarCorreo(valor) {
    return valor.trim().toLowerCase();
}
function normalizarTelefono(valor) {
    return (0, phone_1.normalizePhoneDigits)(valor) ?? '';
}
function normalizarNombre(valor) {
    return valor.trim().toLowerCase();
}
function normalizarGeografia(valor) {
    return (0, geo_inference_1.normalizeGeoValue)(valor);
}
function hashearTodos(valores, normalizar) {
    if (!valores?.length)
        return undefined;
    const digests = valores
        .map((valor) => valor ?? '')
        .map((valor) => (yaEstaHasheado(valor) ? valor.trim().toLowerCase() : normalizar(valor)))
        .filter((valor) => valor.length > 0)
        .map((valor) => (SHA256_HEX.test(valor) ? valor : (0, node_crypto_1.createHash)('sha256').update(valor).digest('hex')));
    return digests.length > 0 ? digests : undefined;
}
function prepararIdentificadores(userData) {
    const datos = userData;
    return {
        ...userData,
        em: hashearTodos(datos.em, normalizarCorreo),
        ph: hashearTodos(datos.ph, normalizarTelefono),
        fn: hashearTodos(datos.fn, normalizarNombre),
        ln: hashearTodos(datos.ln, normalizarNombre),
        externalId: hashearTodos(datos.externalId, (valor) => valor.trim()),
        ct: hashearTodos(datos.ct, normalizarGeografia),
        st: hashearTodos(datos.st, normalizarGeografia),
        country: hashearTodos(datos.country, normalizarGeografia),
    };
}
function parametroSinHashear(userData) {
    for (const parametro of ['em', 'ph', 'fn', 'ln', 'ct', 'st', 'country', 'externalId']) {
        const valores = userData[parametro];
        if (!valores?.length)
            continue;
        if (valores.some((valor) => !SHA256_HEX.test(String(valor ?? ''))))
            return parametro;
    }
    return null;
}
