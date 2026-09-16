import { describe, expect, it } from 'vitest';
import { fechaDeNacimientoValida } from '../../../src/modules/reservations/application/fecha-de-nacimiento';

/**
 * Una fecha imposible guardada sin queja reaparece más tarde como un saludo de cumpleaños absurdo,
 * y para entonces ya no se sabe si fue una errata de tecleo o el dato real de alguien.
 */
describe('fecha de nacimiento', () => {
  it('acepta una fecha razonable', () => {
    expect(fechaDeNacimientoValida('1990-05-14')).toBe(true);
  });

  it('acepta la parte de fecha de una marca de tiempo', () => {
    expect(fechaDeNacimientoValida('1990-05-14T03:00:00.000Z')).toBe(true);
  });

  it('rechaza el futuro', () => {
    const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(fechaDeNacimientoValida(manana)).toBe(false);
  });

  it('rechaza una fecha de hace más de 120 años', () => {
    expect(fechaDeNacimientoValida('1850-01-01')).toBe(false);
  });

  it('rechaza lo que no es una fecha', () => {
    expect(fechaDeNacimientoValida('ayer')).toBe(false);
    expect(fechaDeNacimientoValida('')).toBe(false);
  });
});
