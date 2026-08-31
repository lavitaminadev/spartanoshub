"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regionDelLead = regionDelLead;
const PALABRAS_DE_REGION = ['region', 'comuna', 'ciudad', 'provincia'];
function comparable(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}
function regionDelLead(metadata) {
    const respuestas = metadata?.answers;
    if (!Array.isArray(respuestas))
        return undefined;
    for (const fila of respuestas) {
        const pregunta = comparable(fila?.question);
        if (!PALABRAS_DE_REGION.some((palabra) => pregunta.includes(palabra)))
            continue;
        const respuesta = String(fila?.answer ?? '').trim();
        if (respuesta)
            return respuesta;
    }
    return undefined;
}
