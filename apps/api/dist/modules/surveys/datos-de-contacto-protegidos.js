"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preguntasDeContacto = preguntasDeContacto;
exports.contestadoEn = contestadoEn;
exports.sinDatosDeContacto = sinDatosDeContacto;
exports.soloDatosDeContacto = soloDatosDeContacto;
const shared_1 = require("@espartanos/shared");
function preguntasDeContacto(preguntas) {
    return (preguntas ?? []).filter((pregunta) => Boolean(pregunta.dato));
}
function contestadoEn(respuestas, preguntas, dato) {
    const pregunta = preguntasDeContacto(preguntas).find((candidata) => candidata.dato === dato);
    const valor = pregunta ? respuestas?.[pregunta.id] : undefined;
    return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}
function sinDatosDeContacto(respuestas, preguntas) {
    const copia = { ...(respuestas ?? {}) };
    for (const { id } of preguntasDeContacto(preguntas)) {
        if (copia[id] !== undefined && copia[id] !== null && copia[id] !== '')
            copia[id] = shared_1.MARCA_PROTEGIDA;
    }
    return copia;
}
function soloDatosDeContacto(respuestas, preguntas) {
    const salida = {};
    for (const { id } of preguntasDeContacto(preguntas))
        if (respuestas?.[id] !== undefined)
            salida[id] = respuestas[id];
    return salida;
}
