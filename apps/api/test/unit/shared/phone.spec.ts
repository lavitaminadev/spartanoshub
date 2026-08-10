import { describe, expect, it } from 'vitest';
import { normalizePhone, normalizePhoneDigits } from '../../../src/shared/phone';

describe('normalizePhone', () => {
  it('CRM-03 · el mismo numero escrito de seis formas produce una sola clave', () => {
    // Es la propiedad que sostiene la deduplicacion: si dos de estas divergen, esa persona
    // entra dos veces al CRM y arrastra su propio contacto duplicado.
    const formas = ['+56912345678', '+56 9 1234 5678', '56912345678', '912345678', '9 1234 5678', '0912345678'];

    expect(new Set(formas.map((forma) => normalizePhone(forma))).size).toBe(1);
    expect(normalizePhone(formas[0])).toBe('+56912345678');
  });

  it('respeta el pais cuando quien escribio lo indico con +', () => {
    // Un movil peruano no debe convertirse en un chileno inexistente.
    expect(normalizePhone('+51987654321')).toBe('+51987654321');
    expect(normalizePhone('+1 415 555 2671')).toBe('+14155552671');
  });

  it('descarta el cero inicial de la notacion local', () => {
    expect(normalizePhone('09 1234 5678')).toBe('+56912345678');
  });

  it('no confunde un numero que ya empieza con el prefijo del pais', () => {
    expect(normalizePhone('56912345678')).toBe('+56912345678');
  });

  it('antepone el prefijo a un numero local corto', () => {
    expect(normalizePhone('221234567')).toBe('+56221234567');
  });

  it('devuelve undefined cuando no queda nada utilizable', () => {
    expect(normalizePhone(undefined)).toBeUndefined();
    expect(normalizePhone(null)).toBeUndefined();
    expect(normalizePhone('')).toBeUndefined();
    expect(normalizePhone('sin numero')).toBeUndefined();
    expect(normalizePhone('000')).toBeUndefined();
  });

  it('acota el largo para que no desborde la columna', () => {
    expect(normalizePhone('+123456789012345678901234')!.length).toBeLessThanOrEqual(16);
  });

  it('normalizePhoneDigits entrega el numero sin signo, como lo exigen Meta y Google', () => {
    // Enviarles el `+` produce un hash que no casa con nadie: el evento se acepta y no sirve.
    expect(normalizePhoneDigits('+56 9 1234 5678')).toBe('56912345678');
    expect(normalizePhoneDigits('912345678')).toBe('56912345678');
    expect(normalizePhoneDigits(undefined)).toBeUndefined();
  });
});
