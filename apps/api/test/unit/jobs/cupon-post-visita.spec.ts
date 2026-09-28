import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CuponPostVisitaJob } from '../../../src/core/jobs/cron/cupon-post-visita.job';

/*
 * El cupón automático: sale en el momento que eligió la empresa, y sólo si el cupón sirve.
 *
 * El código se escribía a mano y nadie lo comprobaba: con un error de tipeo, o un cupón
 * desactivado, vencido o de otra empresa, la persona recibía un regalo que la caja rechazaba.
 */
const form = { id: 'form-1', organizationId: 'org-1', clientId: 'casa-costanera', name: 'Casa Costanera', timezone: 'America/Santiago', designConfig: {} };
const reserva = { id: 'r-1', formId: 'form-1', guestEmail: 'ana@correo.cl', guestName: 'Ana Pérez' };
const cuponBueno = { code: 'BIENVENIDA10', clientId: 'casa-costanera', active: true, validUntil: null, maxUses: 0, usageCount: 0 };

function trabajo(opciones: { ajustes: Record<string, unknown>; cupon?: Record<string, unknown> | null; porAsistencia?: unknown[]; conEncuesta?: string[]; surveys?: boolean }) {
  const reservas = {
    find: vi.fn()
      .mockResolvedValueOnce(opciones.porAsistencia ?? [])
      .mockResolvedValueOnce((opciones.conEncuesta ?? []).map((id) => ({ ...reserva, id }))),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn().mockResolvedValue(undefined),
    query: vi.fn(async (sql: string) => {
      if (sql.includes('survey_responses')) return (opciones.conEncuesta ?? []).map((id) => ({ id }));
      // `encuestasHabilitadas` pregunta por las capacidades de la empresa.
      return [{ capabilities: JSON.stringify({ reservations: true, surveys: opciones.surveys ?? true }) }];
    }),
  };
  const formularios = { findOne: vi.fn().mockResolvedValue(form) };
  const cupones = { findOne: vi.fn().mockResolvedValue(opciones.cupon === undefined ? cuponBueno : opciones.cupon) };
  const correo = { send: vi.fn().mockResolvedValue(true) };
  const parametros = { get: vi.fn(async (clave: string) => opciones.ajustes[clave] ?? null) };
  const job = new CuponPostVisitaJob(reservas as never, formularios as never, cupones as never, correo as never, parametros as never);
  return { job, correo, reservas };
}

const encendido = { 'email.coupon_enabled': true, 'email.coupon_code': 'bienvenida10', 'email.coupon_days_valid': 30 };

describe('cupón automático', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tras la asistencia, lo envía a quien vino', async () => {
    const { job, correo } = trabajo({ ajustes: encendido, porAsistencia: [reserva] });
    await expect(job.handle()).resolves.toMatchObject({ enviados: 1 });
    expect(correo.send).toHaveBeenCalledWith('ana@correo.cl', expect.any(String), expect.stringContaining('BIENVENIDA10'), undefined);
  });

  it('con el cupón desactivado no envía nada', async () => {
    const { job, correo } = trabajo({ ajustes: encendido, porAsistencia: [reserva], cupon: { ...cuponBueno, active: false } });
    await job.handle();
    expect(correo.send).not.toHaveBeenCalled();
  });

  it('con un código que no existe no envía nada', async () => {
    const { job, correo } = trabajo({ ajustes: encendido, porAsistencia: [reserva], cupon: null });
    await job.handle();
    expect(correo.send).not.toHaveBeenCalled();
  });

  it('con el cupón de otra empresa no envía nada', async () => {
    const { job, correo } = trabajo({ ajustes: encendido, porAsistencia: [reserva], cupon: { ...cuponBueno, clientId: 'bar-ruperto' } });
    await job.handle();
    expect(correo.send).not.toHaveBeenCalled();
  });

  it('con el cupón vencido no envía nada', async () => {
    const { job, correo } = trabajo({ ajustes: encendido, porAsistencia: [reserva], cupon: { ...cuponBueno, validUntil: new Date('2020-01-01') } });
    await job.handle();
    expect(correo.send).not.toHaveBeenCalled();
  });

  describe('cuando espera la encuesta', () => {
    const porEncuesta = { ...encendido, 'email.coupon_trigger': 'encuesta' };

    it('lo envía a quien terminó la encuesta de su visita', async () => {
      const { job, correo } = trabajo({ ajustes: porEncuesta, conEncuesta: ['r-9'] });
      await expect(job.handle()).resolves.toMatchObject({ enviados: 1 });
      expect(correo.send).toHaveBeenCalledTimes(1);
    });

    it('no lo envía sólo por haber venido', async () => {
      const { job, correo } = trabajo({ ajustes: porEncuesta, porAsistencia: [reserva] });
      await job.handle();
      expect(correo.send).not.toHaveBeenCalled();
    });

    it('sin Encuestas contratado no envía nada', async () => {
      const { job, correo } = trabajo({ ajustes: porEncuesta, conEncuesta: ['r-9'], surveys: false });
      await job.handle();
      expect(correo.send).not.toHaveBeenCalled();
    });
  });

  it('apagado no envía nada', async () => {
    const { job, correo } = trabajo({ ajustes: { ...encendido, 'email.coupon_enabled': false }, porAsistencia: [reserva] });
    await job.handle();
    expect(correo.send).not.toHaveBeenCalled();
  });
});
