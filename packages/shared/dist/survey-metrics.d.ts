/**
 * @fileoverview Agregación de respuestas crudas a los resultados que consume
 * `SurveyResultsPage`. Se usa tanto en el respaldo local (`useSurveyResults`) como en
 * cualquier prueba que quiera verificar el cálculo sin pasar por la API.
 */
import type { Survey, SurveyQuestion, SurveyResponse, SurveyResultsSummary } from './types/survey';
/**
 * Cómo se nombra una pregunta en resultados.
 *
 * Las versiones se rotulan con su número y su vigencia, nunca se suman entre ellas: quien lee ve
 * «v2 (desde 14/10)» y «v1 (hasta 14/10)» como dos bloques, porque no miden lo mismo. Una pregunta
 * simplemente quitada sigue rotulada como archivada.
 */
export declare function etiquetaDePregunta(question: SurveyQuestion): string;
/**
 * Agrega respuestas crudas por pregunta.
 *
 * Una respuesta ausente para una pregunta puntual no cuenta como respondida: `totalAnswers`
 * refleja solo lo que la persona efectivamente contestó, no cuántas personas respondieron la
 * encuesta completa.
 */
export declare function computeSurveyResults(survey: Survey, responses: SurveyResponse[]): SurveyResultsSummary;
//# sourceMappingURL=survey-metrics.d.ts.map