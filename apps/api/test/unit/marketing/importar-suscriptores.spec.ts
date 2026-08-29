import { describe, expect, it } from 'vitest';
import { interpretarCsv, partirLinea } from '../../../src/modules/marketing/importar-suscriptores';

/**
 * Cómo se lee un archivo de correos antes de guardarlo.
 *
 * Lo que se comprueba acá no es que el archivo se lea, sino que **nadie acabe suscrito sin
 * haberlo dicho**. Una fila mal interpretada se convierte en un correo comercial a alguien que no
 * lo pidió, y eso no se deshace.
 */
describe('importar suscriptores', () => {
  it('parte respetando las comillas, porque las respuestas llevan comas', () => {
    expect(partirLinea('ana@x.cl,"Sí, acepto",Ana'))
      .toEqual(['ana@x.cl', 'Sí, acepto', 'Ana']);
  });

  it('acepta punto y coma, que es como exporta media Europa y algunos Excel', () => {
    expect(partirLinea('ana@x.cl;Ana')).toEqual(['ana@x.cl', 'Ana']);
  });

  it('reconoce las columnas de Google Forms con sus nombres largos', () => {
    const { filas } = interpretarCsv(
      'Marca temporal,Dirección de correo electrónico,Nombre completo,¿Acepto recibir novedades?\n'
      + '2026-08-01,Ana@Ejemplo.CL,Ana Pérez,Sí',
    );

    expect(filas).toEqual([
      { email: 'ana@ejemplo.cl', name: 'Ana Pérez', acepta: true, respuestaCruda: 'Sí' },
    ]);
  });

  /*
   * La decisión que evita el peor error posible: dar por consentido lo que no consta. Sin columna
   * de consentimiento la fila entra igual, pero en estado pendiente.
   */
  it('sin columna de consentimiento, nadie acepta', () => {
    const { filas } = interpretarCsv('correo,nombre\nana@x.cl,Ana');

    expect(filas[0].acepta).toBe(false);
  });

  it.each([
    ['Sí', true],
    ['si', true],
    ['SÍ, ACEPTO', true],
    ['Acepto', true],
    ['No', false],
    ['', false],
    ['tal vez', false],
    ['Prefiero no responder', false],
  ])('«%s» cuenta como aceptación: %s', (respuesta, esperado) => {
    const { filas } = interpretarCsv(`correo,acepta promociones\nana@x.cl,"${respuesta}"`);

    expect(filas[0].acepta).toBe(esperado);
  });

  it('descarta lo que no tiene forma de correo, diciendo en qué línea', () => {
    const { filas, descartadas } = interpretarCsv(
      'correo\nana@x.cl\nno-es-un-correo\n\nbea@x.cl',
    );

    expect(filas.map((f) => f.email)).toEqual(['ana@x.cl', 'bea@x.cl']);
    expect(descartadas).toEqual([{ linea: 3, motivo: 'El correo no tiene forma de correo' }]);
  });

  /*
   * Un archivo con la misma dirección dos veces produciría dos correos a la misma persona, y
   * peor: podría entrar aceptando en una fila y sin aceptar en la otra.
   */
  it('descarta los repetidos del propio archivo', () => {
    const { filas, descartadas } = interpretarCsv('correo\nana@x.cl\nANA@X.CL');

    expect(filas).toHaveLength(1);
    expect(descartadas[0].motivo).toBe('Repetido en el archivo');
  });

  it('avisa cuando no hay columna de correo en vez de importar basura', () => {
    const { filas, descartadas } = interpretarCsv('nombre,teléfono\nAna,912345678');

    expect(filas).toHaveLength(0);
    expect(descartadas[0].motivo).toContain('correo');
  });

  it('la coincidencia exacta gana sobre la parcial', () => {
    const { filas } = interpretarCsv('nombre de la empresa,nombre,correo\nACME,Ana,ana@x.cl');

    expect(filas[0].name).toBe('Ana');
  });

  it('un archivo enorme no se importa entero', () => {
    const lineas = ['correo', ...Array.from({ length: 50 }, (_, i) => `p${i}@x.cl`)];
    const { filas } = interpretarCsv(lineas.join('\n'), 10);

    expect(filas).toHaveLength(10);
  });

  it('un archivo sin datos no revienta', () => {
    expect(interpretarCsv('').filas).toEqual([]);
    expect(interpretarCsv('correo').filas).toEqual([]);
  });
});
