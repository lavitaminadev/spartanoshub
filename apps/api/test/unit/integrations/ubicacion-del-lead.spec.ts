import { describe, expect, it } from 'vitest';
import { ubicacionDelLead } from '../../../src/modules/integrations/meta/ubicacion-del-lead';
import { fechaDeNacimientoParaMeta } from '../../../src/modules/integrations/meta/identificadores-meta';
import { normalizeGeoValue } from '../../../src/shared/geo-inference';

/**
 * Ciudad y región, cada una en su parámetro.
 *
 * Meta compara la región contra su lista de regiones: una comuna enviada como región no empareja
 * con nadie y ocupa el lugar de la región de verdad.
 */
describe('ubicación declarada en el formulario', () => {
  const con = (...filas: Array<[string, string]>) => ({ answers: filas.map(([question, answer]) => ({ question, answer })) });

  it('la región va a región y la comuna a ciudad', () => {
    expect(ubicacionDelLead(con(['¿Cuál es tu región?', 'metropolitana'], ['¿Tu comuna?', 'Providencia'])))
      .toEqual({ region: 'metropolitana', ciudad: 'Providencia' });
  });

  it('reconoce la pregunta con tildes y con el carácter invisible que antepone Meta', () => {
    expect(ubicacionDelLead(con(['⁠¿Cuál es tu región?', 'araucanía'])).region).toBe('araucanía');
    expect(ubicacionDelLead(con(['¿En qué ciudad vives?', 'Temuco'])).ciudad).toBe('Temuco');
  });

  it('no inventa nada cuando la pregunta no está ni el teléfono lo dice', () => {
    expect(ubicacionDelLead(con(['¿Cuánto te interesaría invertir?', '$80.000.000']))).toEqual({ region: undefined, ciudad: undefined });
    expect(ubicacionDelLead(null)).toEqual({ region: undefined, ciudad: undefined });
    // Un móvil chileno no codifica zona: de ahí no sale ninguna deducción.
    expect(ubicacionDelLead(null, '+56 9 8123 4567')).toEqual({ region: undefined, ciudad: undefined });
  });

  it('ignora una respuesta en blanco', () => {
    expect(ubicacionDelLead(con(['¿Cuál es tu región?', '   '])).region).toBeUndefined();
  });

  it('completa con el fijo sólo lo que la persona no declaró', () => {
    const soloComuna = ubicacionDelLead(con(['¿Tu comuna?', 'Providencia']), '+56 41 234 5678');
    expect(soloComuna.ciudad).toBe('Providencia');
    // El deducido ya viene normalizado como Meta lo espera; el declarado lo normaliza la cola.
    expect(soloComuna.region).toBe('biobio');
  });

  /* Meta pide los estados de fuera de Estados Unidos en minúsculas, sin puntuación ni espacios. */
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
    for (const [crudo, normalizado] of esperado) expect(normalizeGeoValue(crudo)).toBe(normalizado);
  });
});

describe('fecha de nacimiento para Meta', () => {
  it('viaja como AAAAMMDD', () => {
    expect(fechaDeNacimientoParaMeta('1990-05-14')).toEqual(['19900514']);
    expect(fechaDeNacimientoParaMeta(new Date('1990-05-14T00:00:00Z'))).toEqual(['19900514']);
  });

  it('una fecha a medias no se manda: su hash no emparejaría con nadie', () => {
    expect(fechaDeNacimientoParaMeta('1990-05')).toBeUndefined();
    expect(fechaDeNacimientoParaMeta('')).toBeUndefined();
    expect(fechaDeNacimientoParaMeta(null)).toBeUndefined();
  });
});
