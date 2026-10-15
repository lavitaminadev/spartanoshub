/**
 * Los indicadores de resultados cubren todo el período, aunque el detalle venga recortado.
 *
 * El detalle se recorta para no mandar una encuesta entera en cada carga. Si el panel derivara de
 * él la nota promedio o el NPS, una encuesta con más respuestas que el tope mostraría los números
 * de las últimas y no los del período, sin que nadie pudiera notarlo.
 */

import { describe, expect, it, vi } from 'vitest';
import { SurveysController } from '../../../src/modules/surveys/surveys.controller';

const TOPE_DEL_DETALLE = 500;

/** Respuestas en días consecutivos: las primeras con nota 1, las últimas con nota 5. */
function respuestas(cuantas: number, notaDeLasUltimas: number, notaDelResto: number) {
  return Array.from({ length: cuantas }, (_, indice) => ({
    id: `r${indice}`,
    surveyId: 'e1',
    respondentId: `public:link:${indice}`,
    answers: { nota: indice >= cuantas - TOPE_DEL_DETALLE ? notaDeLasUltimas : notaDelResto },
    rating: indice >= cuantas - TOPE_DEL_DETALLE ? notaDeLasUltimas : notaDelResto,
    submittedAt: new Date(Date.UTC(2026, 0, 1, 0, indice)),
    completedAt: new Date(Date.UTC(2026, 0, 1, 0, indice)),
    teamMessage: null,
    respondentName: null,
    respondentEmail: null,
    reservationId: null,
    attendedAt: null,
    attendedBy: null,
    privacyConsentAt: null,
  }));
}

function armar(filas: unknown[]) {
  const encuesta = {
    id: 'e1', organizationId: 'org', clientId: null, title: 'Encuesta larga', type: 'internal', status: 'active',
    questions: [{ id: 'nota', type: 'rating', question: '¿Cómo fue?', required: true }],
    createdAt: new Date(), createdBy: 'u1', responseCount: filas.length, anonymous: true,
  };
  const surveys = { findOne: vi.fn().mockResolvedValue(encuesta) };
  const responses = { find: vi.fn().mockResolvedValue(filas) };
  const dataSource = { query: vi.fn().mockResolvedValue([]) };
  const accountAccess = { allowedClientIds: vi.fn().mockResolvedValue(undefined), assertClient: vi.fn() };
  const controlador = new SurveysController(surveys as never, responses as never, dataSource as never, accountAccess as never, {} as never);
  const req = { organizationId: 'org', user: { id: 'u1', role: 'admin' } } as never;
  return { controlador, req };
}

describe('indicadores del período', () => {
  it('con más respuestas que el tope, promedio y agregados salen de todas y no sólo del detalle', async () => {
    // 700 respuestas: las 200 primeras con nota 1, las 500 últimas con nota 5. El detalle sólo
    // alcanza a estas últimas, así que derivarlo de él daría 5 en vez del promedio real.
    const { controlador, req } = armar(respuestas(700, 5, 1));
    const resultado = await controlador.results(req, 'e1') as never as {
      totalResponses: number; detalleTruncado: boolean; respuestas: unknown[];
      delPeriodo: { promedio: number | null; completaron: number | null; conMensaje: number };
      questions: Array<{ questionId: string; totalAnswers: number; average?: number | null }>;
    };

    expect(resultado.totalResponses).toBe(700);
    expect(resultado.respuestas).toHaveLength(TOPE_DEL_DETALLE);
    expect(resultado.detalleTruncado).toBe(true);
    // (200×1 + 500×5) / 700 = 3,9
    expect(resultado.delPeriodo.promedio).toBe(3.9);
    expect(resultado.delPeriodo.completaron).toBe(100);
    expect(resultado.questions.find((q) => q.questionId === 'nota')).toMatchObject({ totalAnswers: 700, average: 3.9 });
  });

  it('por debajo del tope el detalle viene entero y no se avisa recorte', async () => {
    const { controlador, req } = armar(respuestas(10, 5, 5));
    const resultado = await controlador.results(req, 'e1') as never as { detalleTruncado: boolean; respuestas: unknown[]; delPeriodo: { promedio: number | null } };
    expect(resultado.detalleTruncado).toBe(false);
    expect(resultado.respuestas).toHaveLength(10);
    expect(resultado.delPeriodo.promedio).toBe(5);
  });
});
