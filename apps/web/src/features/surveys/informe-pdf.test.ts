import { describe, expect, it } from 'vitest';
import type { Survey, SurveyResultsSummary } from '@espartanos/shared';
import { htmlDelInforme } from './informe-pdf';

const survey = {
  id: 's1', title: 'Casa Costanera', type: 'satisfaction', status: 'active',
  questions: [
    { id: 'nota', type: 'rating', question: '¿Cómo fue tu experiencia?', required: true },
    { id: 'correo', type: 'text', question: 'Tu correo', required: true, dato: 'correo' },
    { id: 'mejora', type: 'text', question: '¿Qué mejorarías?', required: false },
  ],
  designConfig: { accentColor: '#123456' },
} as unknown as Survey;

const resumen = {
  surveyId: 's1', totalResponses: 3, completionRate: null, generatedAt: '2026-09-22T12:00:00Z',
  questions: [
    { questionId: 'nota', question: '¿Cómo fue tu experiencia?', required: true, totalAnswers: 3, type: 'rating', average: 4.3, distribution: { '5': 2, '3': 1 } },
    { questionId: 'correo', question: 'Tu correo', required: true, totalAnswers: 3, type: 'text', answers: ['ana@correo.cl'] },
    { questionId: 'mejora', question: '¿Qué mejorarías?', required: false, totalAnswers: 1, type: 'text', answers: ['Más <b>luz</b> en la terraza'] },
  ],
} as unknown as SurveyResultsSummary;

describe('htmlDelInforme', () => {
  const html = htmlDelInforme({ survey, resumen, periodo: 'Últimos 30 días', promedio: 4.3, completaron: 90 });

  it('trae las cifras, el promedio y los comentarios', () => {
    expect(html).toContain('Casa Costanera');
    expect(html).toContain('Promedio <b>4.3</b>');
    expect(html).toContain('Últimos 30 días');
    expect(html).toContain('terraza');
  });

  it('no incluye las preguntas de datos de contacto', () => {
    expect(html).not.toContain('ana@correo.cl');
    expect(html).not.toContain('Tu correo');
  });

  it('escapa lo que escribió quien respondió y usa el color de la encuesta', () => {
    expect(html).toContain('Más &lt;b&gt;luz&lt;/b&gt;');
    expect(html).toContain('#123456');
  });
});
