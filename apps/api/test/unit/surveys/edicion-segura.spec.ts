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

  it('cambiar el tipo abre una versión nueva y cierra la anterior con su fecha', () => {
    const r = aplicarEdicionDePreguntas(BASE, BASE.map((q) => (q.id === 'nota' ? { ...q, type: 'nps' as const } : q)), true, AHORA);
    expect(r.error).toBeUndefined();
    const v2 = r.preguntas.find((q) => q.raizId === 'nota');
    expect(v2).toMatchObject({ id: 'nota~v2', type: 'nps', version: 2, vigenteDesde: AHORA });
    expect(v2!.archivada).toBeUndefined();
    // La v1 queda cerrada: deja de mostrarse, pero sus respuestas siguen en resultados.
    expect(r.preguntas.find((q) => q.id === 'nota')).toMatchObject({ type: 'rating', archivada: true, vigenteHasta: AHORA });
    expect(r.cambios.some((c) => c.includes('Versión nueva de «¿Cómo fue?» (v2)') && c.includes('de estrellas a recomendación 0-10'))).toBe(true);
    // Los dos bloques se rotulan aparte y ninguno suma las respuestas del otro.
    const resultados = computeSurveyResults({ id: 's', title: 't', type: 'customer', questions: r.preguntas, status: 'active', createdAt: AHORA, createdBy: 'u', responses: 2 }, [
      { surveyId: 's', respondentId: 'a', answers: { nota: 5 }, submittedAt: AHORA },
      { surveyId: 's', respondentId: 'b', answers: { 'nota~v2': 10 }, submittedAt: AHORA },
    ]);
    expect(resultados.questions.find((q) => q.questionId === 'nota')).toMatchObject({ question: '¿Cómo fue? (v1 · hasta 15/09)', totalAnswers: 1 });
    expect(resultados.questions.find((q) => q.questionId === 'nota~v2')).toMatchObject({ question: '¿Cómo fue? (v2 · desde 15/09)', totalAnswers: 1 });
  });

  it('cambiar el tipo deja sin regla a la pregunta que dependía de ella, y lo dice', () => {
    const conRegla: SurveyQuestion[] = [BASE[0], { ...BASE[2], mostrarSi: { preguntaId: 'nota', valores: ['1', '2'] } }];
    const r = aplicarEdicionDePreguntas(conRegla, conRegla.map((q) => (q.id === 'nota' ? { ...q, type: 'text' as const } : q)), true, AHORA);
    expect(r.preguntas.find((q) => q.id === 'comentario')?.mostrarSi).toBeUndefined();
    expect(r.cambios).toContain('«Comentario» ahora se muestra siempre: la pregunta de la que dependía cambió de tipo y sus respuestas ya no sirven como condición.');
    // Y nunca queda apuntando a la versión cerrada, que ocultaría la dependiente para siempre.
    expect(preguntasVisibles(r.preguntas, {}).map((q) => q.id)).toContain('comentario');
  });

  it('declarar «ahora pregunta otra cosa» versiona y repunta la regla a la versión nueva', () => {
    const conRegla: SurveyQuestion[] = [BASE[0], { ...BASE[2], mostrarSi: { preguntaId: 'nota', valores: ['1', '2'] } }];
    const editadas = conRegla.map((q) => (q.id === 'nota' ? { ...q, question: '¿Recomendarías el local?' } : q));
    const r = aplicarEdicionDePreguntas(conRegla, editadas, true, AHORA, ['nota']);
    expect(r.preguntas.find((q) => q.raizId === 'nota')).toMatchObject({ id: 'nota~v2', version: 2, question: '¿Recomendarías el local?' });
    // El tipo no cambió: la regla sigue sirviendo, así que se repunta en vez de caerse.
    expect(r.preguntas.find((q) => q.id === 'comentario')?.mostrarSi).toEqual({ preguntaId: 'nota~v2', valores: ['1', '2'] });
    expect(r.cambios).toContain('«Comentario» ahora depende de la v2 de «¿Recomendarías el local?».');
  });

  it('sin declararlo, cambiar la redacción no versiona: sigue sumando en la misma pregunta', () => {
    const editadas = BASE.map((q) => (q.id === 'nota' ? { ...q, question: '¿Qué tal estuvo?' } : q));
    const r = aplicarEdicionDePreguntas(BASE, editadas, true, AHORA);
    expect(r.preguntas.some((q) => q.raizId === 'nota')).toBe(false);
    expect(r.preguntas.find((q) => q.id === 'nota')).toMatchObject({ editadaEn: AHORA });
  });

  it('una tercera versión se numera sobre la familia, no sobre el id editado', () => {
    const v2 = aplicarEdicionDePreguntas(BASE, BASE.map((q) => (q.id === 'nota' ? { ...q, type: 'nps' as const } : q)), true, AHORA).preguntas;
    const editadas = v2.filter((q) => !q.archivada).map((q) => (q.id === 'nota~v2' ? { ...q, type: 'text' as const } : q));
    const r = aplicarEdicionDePreguntas(v2, editadas, true, AHORA);
    expect(r.preguntas.find((q) => q.version === 3)).toMatchObject({ id: 'nota~v3', raizId: 'nota' });
    expect(r.preguntas.find((q) => q.id === 'nota~v2')).toMatchObject({ archivada: true, vigenteHasta: AHORA });
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
