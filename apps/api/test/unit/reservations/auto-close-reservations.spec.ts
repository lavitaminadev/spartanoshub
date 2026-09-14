/**
 * Cierre automático de asistencia: sólo reservas confirmadas, respetando el interruptor del
 * editor (que se guarda como texto) y buscando el estado en la consulta, no después.
 */

import { describe, expect, it, vi } from 'vitest';
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
});
