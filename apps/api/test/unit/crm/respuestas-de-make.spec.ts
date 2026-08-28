import { describe, expect, it } from 'vitest';
import { normalizarCuerpoEntrada } from '../../../src/modules/crm/leads/normalizar-cuerpo-entrada';

/**
 * Las respuestas del formulario tal como las manda Make.
 *
 * Los casos usan el formato real de un formulario de Meta en producción, con sus guiones bajos y
 * el carácter invisible que antepone a los enunciados. Es lo que distingue una prueba que
 * describe el dato de una que describe lo que uno imaginó que sería el dato.
 */
describe('respuestas del formulario que llegan por Make', () => {
  it('guarda las parejas tal como llegan, sin depender de qué pregunta sea', () => {
    const resultado = normalizarCuerpoEntrada({
      nombre: 'Persona',
      pregunta_1: '¿Cuál es tu experiencia previa en negocios o inversiones?',
      respuesta_1: 'he_invertido_en_negocios_pequeños',
      pregunta_2: '¿Cuál es tu región?',
      respuesta_2: 'coquimbo',
    });

    expect((resultado.metadata as Record<string, unknown>).answers).toEqual([
      { question: '¿Cuál es tu experiencia previa en negocios o inversiones?', answer: 'he_invertido_en_negocios_pequeños' },
      { question: '¿Cuál es tu región?', answer: 'coquimbo' },
    ]);
  });

  /*
   * El tope estaba en diez y un formulario con doce perdía las dos últimas sin avisar. No fallaba
   * nada: simplemente no estaban.
   */
  it('no se detiene en la décima pregunta', () => {
    const cuerpo: Record<string, unknown> = { nombre: 'Persona' };
    for (let i = 1; i <= 14; i += 1) {
      cuerpo[`pregunta_${i}`] = `Pregunta ${i}`;
      cuerpo[`respuesta_${i}`] = `Respuesta ${i}`;
    }

    const answers = (normalizarCuerpoEntrada(cuerpo).metadata as Record<string, unknown>).answers;

    expect(answers).toHaveLength(14);
  });

  it('acepta también la lista, que es la forma natural del dato', () => {
    const resultado = normalizarCuerpoEntrada({
      nombre: 'Persona',
      respuestas: [
        { pregunta: '¿Cuánto invertirías?', respuesta: '$80.000.000_-_$100.000.000' },
        { question: 'Region', answer: 'araucanía' },
      ],
    });

    expect((resultado.metadata as Record<string, unknown>).answers).toEqual([
      { question: '¿Cuánto invertirías?', answer: '$80.000.000_-_$100.000.000' },
      { question: 'Region', answer: 'araucanía' },
    ]);
  });

  it('un formulario distinto produce otras preguntas, sin que nada se rompa', () => {
    const inversion = normalizarCuerpoEntrada({
      nombre: 'A', pregunta_1: '¿Cuánto invertirías?', respuesta_1: '+_de_25mm_',
    });
    const arriendo = normalizarCuerpoEntrada({
      nombre: 'B', pregunta_1: '¿Para cuántas personas?', respuesta_1: 'cuatro',
    });

    expect((inversion.metadata as Record<string, unknown>).answers).not.toEqual(
      (arriendo.metadata as Record<string, unknown>).answers,
    );
  });

  it('un lead sin preguntas no guarda una lista vacía', () => {
    const resultado = normalizarCuerpoEntrada({ nombre: 'Persona' });

    expect((resultado.metadata as Record<string, unknown> | undefined)?.answers).toBeUndefined();
  });

  /*
   * Un cuerpo con miles de claves no puede hacer crecer la fila del lead sin medida. Ningún
   * formulario real se acerca al tope.
   */
  it('no guarda más de las que caben', () => {
    const cuerpo: Record<string, unknown> = { nombre: 'Persona' };
    for (let i = 1; i <= 200; i += 1) {
      cuerpo[`pregunta_${i}`] = `P${i}`;
      cuerpo[`respuesta_${i}`] = `R${i}`;
    }

    const answers = (normalizarCuerpoEntrada(cuerpo).metadata as Record<string, unknown>).answers as unknown[];

    expect(answers.length).toBeLessThanOrEqual(60);
  });
});
