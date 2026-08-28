import { describe, expect, it } from 'vitest';
import { atribucionDelLead, construirFbc } from '../../../src/modules/integrations/meta/atribucion-del-lead';

/**
 * De dónde salen las señales de atribución de un lead.
 *
 * Lo que se comprueba acá es sobre todo qué **no** se inventa: un `fbc` armado con una fecha
 * cualquiera, o la IP del servidor en vez de la de la persona, producen valores que Meta acepta
 * y que no emparejan con nadie —o peor, emparejan con quien no es—.
 */
describe('atribución del lead', () => {
  it('construye el fbc con el formato que Meta documenta', () => {
    expect(construirFbc('AbCdEf123', '2026-01-01T00:00:00.000Z')).toBe('fb.1.1767225600000.AbCdEf123');
  });

  /*
   * Meta lo dice explícitamente: el identificador de clic distingue mayúsculas de minúsculas y no
   * hay que retocarlo. Normalizarlo, como se hace con el correo, lo volvería inservible.
   */
  it('respeta las mayúsculas del fbclid', () => {
    expect(construirFbc('IwAR2F4-dbP0l7Mn', '2026-01-01T00:00:00.000Z'))
      .toContain('IwAR2F4-dbP0l7Mn');
  });

  it.each([
    ['sin fbclid', undefined, '2026-01-01T00:00:00.000Z'],
    ['sin fecha', 'AbC', undefined],
    ['con fecha inválida', 'AbC', 'no es una fecha'],
    ['con fbclid vacío', '   ', '2026-01-01T00:00:00.000Z'],
  ])('no construye nada %s', (_caso, fbclid, visto) => {
    expect(construirFbc(fbclid, visto)).toBeUndefined();
  });

  it('prefiere el fbc real de la cookie sobre el construido', () => {
    const atribucion = atribucionDelLead({
      metadata: {
        attribution: {
          fbc: 'fb.1.999.DeLaCookie',
          fbclid: 'DelaUrl',
          capturedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    });

    expect(atribucion.fbc).toBe('fb.1.999.DeLaCookie');
  });

  it('recurre al fbclid cuando la página no tenía el Pixel', () => {
    const atribucion = atribucionDelLead({
      metadata: { attribution: { fbclid: 'DelaUrl', capturedAt: '2026-01-01T00:00:00.000Z' } },
    });

    expect(atribucion.fbc).toBe('fb.1.1767225600000.DelaUrl');
  });

  it('un lead sin nada de atribución no inventa ningún valor', () => {
    expect(atribucionDelLead({ metadata: null })).toEqual({
      fbp: undefined, fbc: undefined, clientIpAddress: undefined, clientUserAgent: undefined,
    });
  });
});
