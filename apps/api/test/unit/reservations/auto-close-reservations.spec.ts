/**
 * Cierre automático de asistencia: sólo reservas confirmadas, respetando el interruptor del
 * editor (que se guarda como texto) y buscando el estado en la consulta, no después.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoCloseReservationsJob } from '../../../src/core/jobs/cron/auto-close-reservations.job';

function armar(designConfig: Record<string, unknown>) {
  const hace2h = new Date(Date.now() - 2 * 3_600_000);
  const reserva = { id: 'r1', formId: 'f1', organizationId: 'o', clientId: 'c', status: 'confirmed', endsAt: hace2h };
  const execute = vi.fn().mockResolvedValue({ affected: 1 });
  const qb = { update: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), execute, delete: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis() };
  const reservations = { find: vi.fn().mockResolvedValue([reserva]), createQueryBuilder: vi.fn(() => qb) };
  const forms = { findOne: vi.fn().mockResolvedValue({ id: 'f1', designConfig }) };
  const events = { create: vi.fn((v) => v), save: vi.fn() };
  const holds = { createQueryBuilder: vi.fn(() => ({ ...qb, execute: vi.fn().mockResolvedValue({ affected: 0 }) })) };
  const job = new AutoCloseReservationsJob(reservations as never, forms as never, events as never, holds as never);
  return { job, reservations, events };
}

describe('AutoCloseReservationsJob', () => {
  it('busca sólo confirmadas y reagendadas: una pendiente nunca aprobada no queda asistida', async () => {
    const { job, reservations } = armar({});
    await job.handle();
    const filtro = reservations.find.mock.calls[0][0].where.status;
    expect(filtro._value ?? filtro.value).toEqual(['confirmed', 'rescheduled']);
  });

  it('respeta «Cerrar la asistencia sola» apagado tal como lo guarda el editor', async () => {
    const { job, events } = armar({ autoCloseAttendance: 'false' });
    await job.handle();
    expect(events.save).not.toHaveBeenCalled();
  });

  it('con el interruptor encendido cierra la visita pasado el margen', async () => {
    const { job, events } = armar({ autoCloseAttendance: 'true', autoCloseAfterMinutes: '60' });
    await job.handle();
    expect(events.save).toHaveBeenCalledTimes(1);
  });

  describe('estadías sin salida al cierre del local', () => {
    function armarEstadia(fin: Date, tramos: Array<{ day: number; start: string; end: string }>) {
      const inicio = new Date(fin.getTime() - 90 * 60_000);
      const reserva = { id: 'r2', formId: 'f1', organizationId: 'o', clientId: 'c', status: 'attended', leftAt: null, startsAt: inicio, endsAt: fin };
      const set = vi.fn().mockReturnThis();
      const qb = { update: vi.fn().mockReturnThis(), set, where: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue({ affected: 1 }), delete: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis() };
      const reservations = { find: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([reserva]), createQueryBuilder: vi.fn(() => qb) };
      const forms = { findOne: vi.fn().mockResolvedValue({ id: 'f1', timezone: 'UTC', designConfig: {}, scheduleConfig: { windows: tramos } }) };
      const events = { create: vi.fn((v) => v), save: vi.fn() };
      const holds = { createQueryBuilder: vi.fn(() => ({ ...qb, execute: vi.fn().mockResolvedValue({ affected: 0 }) })) };
      const job = new AutoCloseReservationsJob(reservations as never, forms as never, events as never, holds as never);
      return { job, events, set };
    }

    it('sin horario ese día toma el fin previsto como tope y lo deja dicho', async () => {
      const fin = new Date(Date.now() - 3_600_000);
      const { job, events, set } = armarEstadia(fin, []);
      await job.handle();
      expect(set).toHaveBeenCalledWith({ leftAt: fin, departureSource: 'local_closed' });
      expect(events.save).toHaveBeenCalledWith(expect.objectContaining({ type: 'departed', actorType: 'system', metadata: expect.objectContaining({ source: 'local_closed', tope: 'fin_previsto' }) }));
    });

    describe('con la hora fija: martes 22-09-2026 a las 20:00 UTC', () => {
      beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-22T20:00:00Z')); });
      afterEach(() => { vi.useRealTimers(); });

      it('si el equipo la alargó más allá del cierre, se respeta el fin alargado', async () => {
        const { job, events } = armarEstadia(new Date('2026-09-22T19:00:00Z'), [{ day: 2, start: '12:00', end: '18:00' }]);
        await job.handle();
        expect(events.save).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ tope: 'fin_alargado' }) }));
      });

      it('con el cierre ya pasado, la hora de salida es la del cierre', async () => {
        const { job, set } = armarEstadia(new Date('2026-09-22T18:30:00Z'), [{ day: 2, start: '12:00', end: '19:30' }]);
        await job.handle();
        expect(set).toHaveBeenCalledWith({ leftAt: new Date('2026-09-22T19:30:00Z'), departureSource: 'local_closed' });
      });

      it('mientras el local no cierra, no toca la estadía', async () => {
        const { job, events } = armarEstadia(new Date('2026-09-22T19:30:00Z'), [{ day: 2, start: '12:00', end: '23:00' }]);
        await job.handle();
        expect(events.save).not.toHaveBeenCalled();
      });
    });
  });
});
