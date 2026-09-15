import { describe, expect, it } from 'vitest';
import type { SurveyQuestion } from '@espartanos/shared';
import { aplicarEdicionDePreguntas, computeSurveyResults, preguntasVisibles } from '@espartanos/shared';

const AHORA = '2026-09-15T12:00:00.000Z';
const BASE: SurveyQuestion[] = [
  { id: 'nota', type: 'rating', question: '¿Cómo fue?', required: true },
  { id: 'volveria', type: 'multiple-choice', question: '¿Volverías?', required: true, options: ['Sí', 'No'] },
  { id: 'comentario', type: 'text', question: 'Comentario', required: false },
];

describe('editar una encuesta con respuestas sin perder datos', () => {
  it('quitar una pregunta con respuestas la archiva, y se sigue viendo en resultados', () => {
    const r = aplicarEdicionDePreguntas(BASE, BASE.filter((q) => q.id !== 'comentario'), true, AHORA);
    expect(r.error).toBeUndefined();
    expect(r.preguntas.find((q) => q.id === 'comentario')).toMatchObject({ archivada: true });
    expect(r.cambios).toContain('Pregunta archivada: «Comentario» (sus respuestas se conservan)');
    // No se muestra a quien responde…
    expect(preguntasVisibles(r.preguntas, {}).map((q) => q.id)).toEqual(['nota', 'volveria']);
    // …pero sus respuestas siguen contando en resultados.
    const resultados = computeSurveyResults({ id: 's', title: 't', type: 'customer', questions: r.preguntas, status: 'active', createdAt: AHORA, createdBy: 'u', responses: 1 }, [
      { surveyId: 's', respondentId: 'p', answers: { nota: 5, comentario: 'Muy bueno' }, submittedAt: AHORA },
    ]);
    expect(resultados.questions.find((q) => q.questionId === 'comentario')).toMatchObject({ question: 'Comentario (archivada)', totalAnswers: 1 });
  });

  it('sin respuestas, quitar es quitar', () => {
    const r = aplicarEdicionDePreguntas(BASE, BASE.slice(0, 2), false, AHORA);
    expect(r.preguntas.map((q) => q.id)).toEqual(['nota', 'volveria']);
    expect(r.cambios).toContain('Pregunta quitada: «Comentario»');
  });

  it('cambiar la redacción conserva el id y marca la fecha', () => {
    const editadas = BASE.map((q) => (q.id === 'nota' ? { ...q, question: '¿Qué tal tu visita?' } : q));
    const r = aplicarEdicionDePreguntas(BASE, editadas, true, AHORA);
    expect(r.preguntas.find((q) => q.id === 'nota')).toMatchObject({ question: '¿Qué tal tu visita?', editadaEn: AHORA });
    expect(r.cambios).toContain('Redacción cambiada: «¿Cómo fue?» → «¿Qué tal tu visita?»');
  });

  it('mover los datos de contacto al principio no cuenta como cambio de orden', () => {
    const conDato: SurveyQuestion[] = [...BASE, { id: 'dato-nombre', type: 'text', question: 'Tu nombre', required: false, dato: 'nombre' }];
    const r = aplicarEdicionDePreguntas(conDato, [conDato[3], ...BASE], true, AHORA);
    expect(r.cambios).toEqual([]);
  });

  it('no deja cambiar el tipo de una pregunta con respuestas', () => {
    const r = aplicarEdicionDePreguntas(BASE, BASE.map((q) => (q.id === 'nota' ? { ...q, type: 'text' as const } : q)), true, AHORA);
    expect(r.error).toMatch(/no se puede cambiar a texto libre/);
    expect(r.preguntas).toBe(BASE);
  });

  it('describe agregados, opciones, obligatoriedad, restauración y orden', () => {
    const archivada = aplicarEdicionDePreguntas(BASE, BASE.slice(0, 2), true, AHORA).preguntas;
    const editadas: SurveyQuestion[] = [
      { ...BASE[1], options: ['Sí', 'Tal vez'], required: false },
      BASE[0],
      { ...archivada[2], archivada: undefined },
      { id: 'nueva', type: 'text', question: '¿Qué mejorarías?', required: false },
    ];
    const r = aplicarEdicionDePreguntas(archivada, editadas, true, AHORA);
    expect(r.cambios).toEqual(expect.arrayContaining([
      'Pregunta agregada: «¿Qué mejorarías?»',
      'Pregunta restaurada: «Comentario»',
      '«¿Volverías?» ahora es opcional',
      'Opciones de «¿Volverías?»: se agregó «Tal vez»; se quitó «No» (las respuestas con esas opciones se conservan)',
      'Cambió el orden de las preguntas',
    ]));
  });
});
