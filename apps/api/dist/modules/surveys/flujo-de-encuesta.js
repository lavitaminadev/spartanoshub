"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LARGO_MAXIMO_MENSAJE = exports.UMBRAL_POR_DEFECTO = void 0;
exports.preguntaDeNota = preguntaDeNota;
exports.notaValida = notaValida;
exports.siguientePaso = siguientePaso;
exports.unirRespuestas = unirRespuestas;
exports.obligatoriasPendientes = obligatoriasPendientes;
const shared_1 = require("@espartanos/shared");
exports.UMBRAL_POR_DEFECTO = 4;
function preguntaDeNota(preguntas) {
    return preguntas.find((pregunta) => pregunta.type === 'rating');
}
function notaValida(nota) {
    return typeof nota === 'number' && Number.isInteger(nota) && nota >= 1 && nota <= 5;
}
function siguientePaso(nota, umbral) {
    const limite = typeof umbral === 'number' && umbral >= 1 && umbral <= 5 ? umbral : exports.UMBRAL_POR_DEFECTO;
    return nota < limite ? 'mensaje-al-equipo' : 'ofrecer-encuesta';
}
function unirRespuestas(preguntas, guardadas, nuevas) {
    if (!nuevas)
        return { ...guardadas };
    const conocidas = new Set(preguntas.map((pregunta) => pregunta.id));
    const desconocidas = Object.keys(nuevas).filter((clave) => !conocidas.has(clave));
    if (desconocidas.length > 0)
        throw new Error(`La encuesta no tiene las preguntas: ${desconocidas.join(', ')}`);
    return { ...guardadas, ...nuevas };
}
function obligatoriasPendientes(preguntas, respuestas) {
    const nota = preguntaDeNota(preguntas);
    return preguntas
        .filter((pregunta) => pregunta.required && pregunta.id !== nota?.id && (0, shared_1.preguntaVisible)(pregunta, preguntas, respuestas))
        .filter((pregunta) => {
        const valor = respuestas[pregunta.id];
        return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
    })
        .map((pregunta) => pregunta.question);
}
exports.LARGO_MAXIMO_MENSAJE = 2000;
