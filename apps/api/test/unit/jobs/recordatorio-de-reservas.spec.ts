import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordatorioDeReservasJob } from '../../../src/core/jobs/cron/recordatorio-de-reservas.job';

/*
 * El recordatorio sólo sale para reservas que siguen en pie, y sólo se da por enviado lo que salió.
 *
 * El estado se filtra en la consulta, así que la prueba mira el filtro: un resultado simulado no
 * distinguiría un filtro correcto de una coincidencia.
 */
const form = { id: 'f1', organizationId: 'org-1', clientId: 'cli-1', name: 'Refugio', timezone: 'America/Santiago' };
const reserva = {
  id: 'r1', formId: 'f1', guestEmail: 'ana@correo.cl', guestName: 'Ana', partySize: 2, referenceCode: 'ABC123',
  startsAt: new Date(Date.now() + 3 * 3_600_000),
};

function trabajo(envio: boolean) {
  const reservas = { find: vi.fn().mockResolvedValueOnce([reserva]).mockResolvedValueOnce([]), update: vi.fn().mockResolvedValue(undefined) };
  const formularios = { findOne: vi.fn().mockResolvedValue(form) };
  const correo = { send: vi.fn().mockResolvedValue(envio) };
  const parametros = { get: vi.fn(async (clave: string) => (clave.endsWith('_enabled') ? true : clave.endsWith('_hours') ? 24 : null)) };
  const job = new RecordatorioDeReservasJob(reservas as never, formularios as never, correo as never, parametros as never);
  return { job, reservas, correo };
}

describe('recordatorio de reservas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no busca canceladas, en espera ni pendientes: sólo confirmadas o reagendadas', async () => {
    const { job, reservas } = trabajo(true);
    await job.handle();
    for (const [consulta] of reservas.find.mock.calls as Array<[{ where: { status: { value: string[] } } }]>) {
      const estados = consulta.where.status.value;
      expect([...estados].sort()).toEqual(['confirmed', 'rescheduled']);
      for (const ajeno of ['cancelled_client', 'cancelled_business', 'waitlist', 'pending', 'no_show', 'attended']) {
        expect(estados).not.toContain(ajeno);
      }
    }
  });

  it('marca el recordatorio como enviado cuando el correo salió', async () => {
    const { job, reservas } = trabajo(true);
    await job.handle();
    expect(reservas.update).toHaveBeenCalledWith('r1', { reminderSentAt: expect.any(Date) });
  });

  it('no lo marca si el correo no salió, para reintentarlo', async () => {
    const { job, correo, reservas } = trabajo(false);
    await job.handle();
    expect(correo.send).toHaveBeenCalledTimes(1);
    expect(reservas.update).not.toHaveBeenCalled();
  });
});
