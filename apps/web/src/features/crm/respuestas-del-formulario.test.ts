import { describe, expect, it } from 'vitest';
import { legible, respuestasDelFormulario } from './respuestas-del-formulario';

/**
 * Cómo se leen en la ficha las respuestas que llegan de Meta.
 *
 * Los valores son los de un formulario real en producción: opciones con guiones bajos y
 * enunciados con un junta-palabras invisible delante del signo de interrogación. Puestos crudos
 * en la pantalla se leen como un volcado de base de datos.
 */
describe('respuestas del formulario', () => {
  it.each([
    ['he_invertido_en_negocios_pequeños', 'He invertido en negocios pequeños'],
    ['invertir_y_operar', 'Invertir y operar'],
    ['nunca_he_invertido_antes', 'Nunca he invertido antes'],
    ['coquimbo', 'Coquimbo'],
    ['araucanía', 'Araucanía'],
  ])('«%s» se lee «%s»', (crudo, esperado) => {
    expect(legible(crudo)).toBe(esperado);
  });

  /*
   * Las cifras salen intactas. Cualquier intento de «arreglar» el formato de un rango de dinero
   * lo estropea, y es justo el dato que decide si se llama a esta persona hoy o la semana que
   * viene.
   */
  it.each([
    ['$80.000.000_-_$100.000.000', '$80.000.000 - $100.000.000'],
    ['+_de_25mm_', '+ de 25mm'],
  ])('«%s» conserva sus cifras: «%s»', (crudo, esperado) => {
    expect(legible(crudo)).toBe(esperado);
  });

  it('quita el carácter invisible que Meta antepone al enunciado', () => {
    const conJuntaPalabras = '⁠¿Cuál es tu región?';

    expect(legible(conJuntaPalabras)).toBe('¿Cuál es tu región?');
    expect(legible(conJuntaPalabras)).not.toContain('⁠');
  });

  it('arma la lista lista para pintar', () => {
    const filas = respuestasDelFormulario({
      answers: [
        { question: '⁠¿Te interesa operar un local o solo invertir?', answer: 'invertir_y_operar' },
        { question: '⁠¿Cuál es tu región?', answer: 'metropolitana' },
      ],
    });

    expect(filas).toEqual([
      { question: '¿Te interesa operar un local o solo invertir?', answer: 'Invertir y operar' },
      { question: '¿Cuál es tu región?', answer: 'Metropolitana' },
    ]);
  });

  /*
   * Una pregunta que quedó sin contestar ocupa una fila y no dice nada. Meta las manda cuando la
   * persona deja opcionales sin rellenar.
   */
  it('descarta las preguntas sin respuesta', () => {
    const filas = respuestasDelFormulario({
      answers: [
        { question: '¿Cuál es tu región?', answer: 'coquimbo' },
        { question: '¿Algo más?', answer: '' },
        { question: '', answer: 'huérfana' },
      ],
    });

    expect(filas).toHaveLength(1);
  });

  it.each([
    ['sin metadata', null],
    ['sin respuestas', {}],
    ['con respuestas que no son lista', { answers: 'nada' }],
  ])('no revienta %s', (_caso, metadata) => {
    expect(respuestasDelFormulario(metadata as Record<string, unknown> | null)).toEqual([]);
  });
});
