"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ubicacionDelLead = ubicacionDelLead;
const geo_inference_1 = require("../../../shared/geo-inference");
const PALABRAS_DE_REGION = ['region', 'provincia'];
const PALABRAS_DE_CIUDAD = ['comuna', 'ciudad', 'localidad'];
function comparable(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}
function respuestaQueMencione(respuestas, palabras) {
    for (const fila of respuestas) {
        const pregunta = comparable(fila?.question);
        if (!palabras.some((palabra) => pregunta.includes(palabra)))
            continue;
        const respuesta = String(fila?.answer ?? '').trim();
        if (respuesta)
            return respuesta;
    }
    return undefined;
}
function ubicacionDelLead(metadata, telefono) {
    const respuestas = metadata?.answers;
    const filas = Array.isArray(respuestas) ? respuestas : [];
    const declarada = {
        region: respuestaQueMencione(filas, PALABRAS_DE_REGION),
        ciudad: respuestaQueMencione(filas, PALABRAS_DE_CIUDAD),
    };
    if (declarada.region && declarada.ciudad)
        return declarada;
    const deducida = (0, geo_inference_1.inferLocationFromPhone)(telefono);
    return {
        region: declarada.region ?? deducida.region,
        ciudad: declarada.ciudad ?? deducida.city,
    };
}
