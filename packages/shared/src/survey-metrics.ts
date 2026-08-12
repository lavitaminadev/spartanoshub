/**
 * @fileoverview Agregación de respuestas crudas a los resultados que consume
 * `SurveyResultsPage`. Se usa tanto en el respaldo local (`useSurveyResults`) como en
 * cualquier prueba que quiera verificar el cálculo sin pasar por la API.
 */

import type {
  Survey,
  SurveyQuestionResult,
  SurveyResponse,
  SurveyResultsSummary,
} from './types/survey';

/** Puntaje NPS: % promotores (9-10) menos % detractores (0-6), sobre las respuestas válidas. */
function aggregateNps(values: number[]): { score: number | null; promoters: number; passives: number; detractors: number } {
  const promoters = values.filter((value) => value >= 9).length;
  const detractors = values.filter((value) => value <= 6).length;
  const passives = values.length - promoters - detractors;
  const score = values.length > 0 ? Math.round(((promoters - detractors) / values.length) * 100) : null;
  return { score, promoters, passives, detractors };
}

function aggregateRating(values: number[]): { average: number | null; distribution: Record<string, number> } {
  const distribution: Record<string, number> = {};
  for (const value of values) {
    const key = String(value);
    distribution[key] = (distribution[key] ?? 0) + 1;
  }
  const average = values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
  return { average, distribution };
}

function aggregateChoice(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
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
export function computeSurveyResults(survey: Survey, responses: SurveyResponse[]): SurveyResultsSummary {
  const questions: SurveyQuestionResult[] = survey.questions.map((question) => {
    const raw = responses
      .map((response) => response.answers[question.id])
      .filter((value): value is string | number => value !== undefined && value !== '');

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
