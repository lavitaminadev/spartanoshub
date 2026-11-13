import { describe, expect, it } from 'vitest';
import { consecuenciaDeCancelar } from './consecuencia-de-cancelar';

const SANTIAGO = 'America/Santiago';

describe('consecuenciaDeCancelar', () => {
  it('nombra las personas, el día y la hora de la reserva', () => {
    expect(consecuenciaDeCancelar({ partySize: 2, startsAt: '2026-11-13T21:59:00.000Z', timezone: SANTIAGO }))
      .toBe('Pierdes tu mesa para 2 personas del viernes 13 de noviembre a las 18:59. Si después quieres ir, tendrás que reservar de nuevo.');
  });

  it('dice «1 persona», en singular', () => {
    expect(consecuenciaDeCancelar({ partySize: 1, startsAt: '2026-11-13T21:59:00.000Z', timezone: SANTIAGO }))
      .toContain('para 1 persona del');
  });

  /**
   * 02:30 del sábado en UTC son las 23:30 del viernes en Santiago. Con la zona del navegador o
   * con UTC, el comensal leería que pierde la mesa del sábado.
   */
  it('usa el día y la hora del local, no los de UTC', () => {
    expect(consecuenciaDeCancelar({ partySize: 2, startsAt: '2026-11-14T02:30:00.000Z', timezone: SANTIAGO }))
      .toContain('del viernes 13 de noviembre a las 23:30');
  });
});
