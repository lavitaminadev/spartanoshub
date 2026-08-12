/**
 * @fileoverview Agregación de respuestas crudas a los resultados que consume
 * `SurveyResultsPage`. Se usa tanto en el respaldo local (`useSurveyResults`) como en
 * cualquier prueba que quiera verificar el cálculo sin pasar por la API.
 */
import type { Survey, SurveyResponse, SurveyResultsSummary } from './types/survey';
/**
 * Agrega respuestas crudas por pregunta.
 *
 * Una respuesta ausente para una pregunta puntual no cuenta como respondida: `totalAnswers`
 * refleja solo lo que la persona efectivamente contestó, no cuántas personas respondieron la
 * encuesta completa.
 */
export declare function computeSurveyResults(survey: Survey, responses: SurveyResponse[]): SurveyResultsSummary;
//# sourceMappingURL=survey-metrics.d.ts.map