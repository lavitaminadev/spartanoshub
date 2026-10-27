"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preguntasContestables = preguntasContestables;
exports.respuestasFueraDeRango = respuestasFueraDeRango;
const RATING = { min: 1, max: 5 };
const NPS = { min: 0, max: 10 };
function preguntasContestables(preguntas) {
    return preguntas.filter((pregunta) => !pregunta.archivada);
}
function respuestasFueraDeRango(preguntas, respuestas) {
    const problemas = [];
    for (const pregunta of preguntasContestables(preguntas)) {
        const valor = respuestas[pregunta.id];
        if (valor === undefined || valor === null || valor === '')
            continue;
        if (pregunta.type === 'rating' || pregunta.type === 'nps') {
            const { min, max } = pregunta.type === 'rating' ? RATING : NPS;
            const numero = typeof valor === 'number' ? valor : Number(valor);
            if (!Number.isInteger(numero) || numero < min || numero > max) {
                problemas.push(`«${pregunta.question}» admite un valor entre ${min} y ${max}`);
            }
        }
        else if (pregunta.type === 'multiple-choice') {
            if (typeof valor !== 'string' || !(pregunta.options ?? []).includes(valor)) {
                problemas.push(`«${pregunta.question}»: la opción elegida no existe`);
            }
        }
    }
    return problemas;
}
