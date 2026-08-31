import { describe, expect, it } from 'vitest';
import { regionDelLead } from '../../../src/modules/integrations/meta/region-del-lead';
import { normalizeGeoValue } from '../../../src/shared/geo-inference';

/**
 * La región declarada en el formulario viaja como `st`.
 *
 * Los formularios de Lead Ads la preguntan y la respuesta ya está guardada, así que enviarla no
 * pide ningún dato nuevo y suma un parámetro de emparejamiento.
 */
describe('región declarada en el formulario', () => {
  const con = (question: string, answer: string) => ({ answers: [{ question, answer }] });

  it('la encuentra aunque la pregunta lleve tildes y signos', () => {
    expect(regionDelLead(con('¿Cuál es tu región?', 'metropolitana'))).toBe('metropolitana');
  });

  it('la encuentra con el carácter invisible que antepone Meta', () => {
    // Las preguntas reales llegan con U+2060 delante; sin limpiarlo, la comparación falla.
    expect(regionDelLead(con('⁠¿Cuál es tu región?', 'araucanía'))).toBe('araucanía');
  });

  it('no inventa nada cuando la pregunta no está', () => {
    expect(regionDelLead(con('¿Cuánto te interesaría invertir?', '$80.000.000'))).toBeUndefined();
    expect(regionDelLead({ answers: [] })).toBeUndefined();
    expect(regionDelLead(null)).toBeUndefined();
  });

  it('ignora una respuesta en blanco', () => {
    expect(regionDelLead(con('¿Cuál es tu región?', '   '))).toBeUndefined();
  });

  /*
   * Meta pide los estados de fuera de Estados Unidos en minúsculas, sin puntuación, caracteres
   * especiales ni espacios. Estas son las regiones reales que llegan del formulario.
   */
  it('las regiones chilenas quedan como Meta las exige', () => {
    const esperado: Array<[string, string]> = [
      ['metropolitana', 'metropolitana'],
      ['araucanía', 'araucania'],
      ["o'higgins", 'ohiggins'],
      ['bío-bío', 'biobio'],
      ['los_ríos', 'losrios'],
      ['ñuble', 'nuble'],
      ['valparaíso', 'valparaiso'],
      ['tarapacá', 'tarapaca'],
      ['los_lagos', 'loslagos'],
      ['coquimbo', 'coquimbo'],
    ];

    for (const [crudo, normalizado] of esperado) {
      expect(normalizeGeoValue(crudo)).toBe(normalizado);
    }
  });
});
