"use strict";
/**
 * @fileoverview Agregación de respuestas crudas a los resultados que consume
 * `SurveyResultsPage`. Se usa tanto en el respaldo local (`useSurveyResults`) como en
 * cualquier prueba que quiera verificar el cálculo sin pasar por la API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.etiquetaDePregunta = etiquetaDePregunta;
exports.computeSurveyResults = computeSurveyResults;
const diaCorto = (iso) => {
    const [, mes, jornada] = iso.slice(0, 10).split('-');
    return jornada ? `${jornada}/${mes}` : iso;
};
/**
 * Cómo se nombra una pregunta en resultados.
 *
 * Las versiones se rotulan con su número y su vigencia, nunca se suman entre ellas: quien lee ve
 * «v2 (desde 14/10)» y «v1 (hasta 14/10)» como dos bloques, porque no miden lo mismo. Una pregunta
 * simplemente quitada sigue rotulada como archivada.
 */
function etiquetaDePregunta(question) {
    const notas = [];
    if ((question.version ?? 1) > 1 || question.raizId || question.vigenteHasta)
        notas.push(`v${question.version ?? 1}`);
    if (question.vigenteHasta)
        notas.push(`hasta ${diaCorto(question.vigenteHasta)}`);
    else if (question.vigenteDesde)
        notas.push(`desde ${diaCorto(question.vigenteDesde)}`);
    // «Cerrada por una versión nueva» ya se lee en «hasta …»; archivada se dice sólo si se quitó.
    if (question.archivada && !question.vigenteHasta)
        notas.push('archivada');
    return notas.length ? `${question.question} (${notas.join(' · ')})` : question.question;
}
/** Puntaje NPS: % promotores (9-10) menos % detractores (0-6), sobre las respuestas válidas. */
function aggregateNps(values) {
    const promoters = values.filter((value) => value >= 9).length;
    const detractors = values.filter((value) => value <= 6).length;
    const passives = values.length - promoters - detractors;
    const score = values.length > 0 ? Math.round(((promoters - detractors) / values.length) * 100) : null;
    return { score, promoters, passives, detractors };
}
function aggregateRating(values) {
    const distribution = {};
    for (const value of values) {
        const key = String(value);
        distribution[key] = (distribution[key] ?? 0) + 1;
    }
    const average = values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
    return { average, distribution };
}
function aggregateChoice(values) {
    const counts = {};
    for (const value of values) {
        counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
}
/**
 * Agrega respuestas crudas por pregunta.
 *
 * Una respuesta ausente para una pregunta puntual no cuenta como respondida: `totalAnswers`
 * refleja solo lo que la persona efectivamente contestó, no cuántas personas respondieron la
 * encuesta completa.
 */
function computeSurveyResults(survey, responses) {
    // Los datos de contacto identifican a una persona: se leen en cada respuesta, no se agregan.
    // Las archivadas y las versiones cerradas siguen en resultados con su marca: cada id agrupa sólo
    // sus propias respuestas, así que dos versiones nunca se promedian juntas.
    const questions = survey.questions.filter((question) => !question.dato).map((original) => {
        const etiqueta = etiquetaDePregunta(original);
        const question = etiqueta === original.question ? original : { ...original, question: etiqueta };
        const raw = responses
            .map((response) => response.answers[question.id])
            .filter((value) => value !== undefined && value !== '');
        if (question.type === 'nps') {
            const numeric = raw.map((value) => Number(value)).filter((value) => Number.isFinite(value));
            return {
                questionId: question.id,
                question: question.question,
                required: question.required,
                totalAnswers: numeric.length,
                type: 'nps',
                ...aggregateNps(numeric),
            };
        }
        if (question.type === 'rating') {
            const numeric = raw.map((value) => Number(value)).filter((value) => Number.isFinite(value));
            return {
                questionId: question.id,
                question: question.question,
                required: question.required,
                totalAnswers: numeric.length,
                type: 'rating',
                ...aggregateRating(numeric),
            };
        }
        if (question.type === 'multiple-choice') {
            const values = raw.map((value) => String(value));
            return {
                questionId: question.id,
                question: question.question,
                required: question.required,
                totalAnswers: values.length,
                type: 'multiple-choice',
                counts: aggregateChoice(values),
            };
        }
        const answers = raw.map((value) => String(value));
        return {
            questionId: question.id,
            question: question.question,
            required: question.required,
            totalAnswers: answers.length,
            type: 'text',
            answers,
        };
    });
    const respondentIds = new Set(responses.map((response) => response.respondentId));
    const completionRate = survey.recipients?.length
        ? Math.round((respondentIds.size / survey.recipients.length) * 100)
        : null;
    return {
        surveyId: survey.id,
        totalResponses: responses.length,
        completionRate,
        questions,
        generatedAt: new Date().toISOString(),
    };
}
//# sourceMappingURL=survey-metrics.js.map