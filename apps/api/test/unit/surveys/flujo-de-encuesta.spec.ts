/**
 * Qué se garantiza: la nota decide el camino, completar por pasos no borra lo ya guardado, y quien
 * no quiere contestar la encuesta puede terminar con sólo su nota.
 */

import { describe, expect, it } from 'vitest';
import type { SurveyQuestion } from '@espartanos/shared';
import {
  notaValida, obligatoriasPendientes, preguntaDeNota, siguientePaso, unirRespuestas, UMBRAL_POR_DEFECTO,
} from '../../../src/modules/surveys/flujo-de-encuesta';

const PREGUNTAS: SurveyQuestion[] = [
  { id: 'intro', type: 'text', question: 'Comentario libre', required: false },
  { id: 'nota', type: 'rating', question: '¿Cómo fue tu visita?', required: true },
  { id: 'volveria', type: 'multiple-choice', question: '¿Volverías?', required: true, options: ['Sí', 'No'] },
];

describe('flujo de encuesta', () => {
  it('abre con la primera pregunta de estrellas, aunque no sea la primera de la lista', () => {
    expect(preguntaDeNota(PREGUNTAS)?.id).toBe('nota');
    expect(preguntaDeNota([{ id: 'a', type: 'text', question: 'x', required: false }])).toBeUndefined();
  });

  it('acepta sólo notas enteras de 1 a 5', () => {
    for (const ok of [1, 3, 5]) expect(notaValida(ok)).toBe(true);
    for (const mala of [0, 6, 3.5, '4', null, undefined, Number.NaN]) expect(notaValida(mala)).toBe(false);
  });

  /* Con el umbral de fábrica, 3 estrellas es nota baja y 4 ya es buena: es el corte que se pidió. */
  it('manda la nota baja al mensaje privado y la alta a ofrecer la encuesta', () => {
    expect(UMBRAL_POR_DEFECTO).toBe(4);
    expect(siguientePaso(1, undefined)).toBe('mensaje-al-equipo');
    expect(siguientePaso(3, undefined)).toBe('mensaje-al-equipo');
    expect(siguientePaso(4, undefined)).toBe('ofrecer-encuesta');
    expect(siguientePaso(5, undefined)).toBe('ofrecer-encuesta');
  });

  it('respeta el umbral que configuró la encuesta, e ignora uno sin sentido', () => {
    expect(siguientePaso(4, 5)).toBe('mensaje-al-equipo');
    expect(siguientePaso(3, 3)).toBe('ofrecer-encuesta');
    expect(siguientePaso(3, 99)).toBe('mensaje-al-equipo');
    expect(siguientePaso(3, 'cuatro')).toBe('mensaje-al-equipo');
  });

  it('no borra la nota al guardar las respuestas del paso siguiente', () => {
    const unidas = unirRespuestas(PREGUNTAS, { nota: 5 }, { volveria: 'Sí' });
    expect(unidas).toEqual({ nota: 5, volveria: 'Sí' });
  });

  it('rechaza preguntas que la encuesta no tiene', () => {
    expect(() => unirRespuestas(PREGUNTAS, { nota: 5 }, { inventada: 'x' })).toThrow('inventada');
  });

  it('no cuenta la nota entre las obligatorias pendientes', () => {
    expect(obligatoriasPendientes(PREGUNTAS, { nota: 5 })).toEqual(['¿Volverías?']);
    expect(obligatoriasPendientes(PREGUNTAS, { nota: 5, volveria: 'Sí' })).toEqual([]);
  });

  it('trata un texto en blanco como no respondido', () => {
    const conTexto: SurveyQuestion[] = [...PREGUNTAS, { id: 'por', type: 'text', question: '¿Por qué?', required: true }];
    expect(obligatoriasPendientes(conTexto, { nota: 5, volveria: 'Sí', por: '   ' })).toEqual(['¿Por qué?']);
  });
});
