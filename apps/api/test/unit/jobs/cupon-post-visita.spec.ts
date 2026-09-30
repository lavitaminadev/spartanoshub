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
  // Quien pidió beneficios está en la lista, así que tiene de dónde darse de baja.
  const suscriptores = { findOne: vi.fn().mockResolvedValue({ id: 's-1', unsubscribeToken: 'tok-123' }) };
  const job = new CuponPostVisitaJob(reservas as never, formularios as never, cupones as never, correo as never, parametros as never, suscriptores as never);
  return { job, correo, reservas, suscriptores };
}

const encendido = { 'email.coupon_enabled': true, 'email.coupon_code': 'bienvenida10', 'email.coupon_days_valid': 30 };

describe('cupón automático', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tras la asistencia, lo envía a quien vino', async () => {
    const { job, correo } = trabajo({ ajustes: encendido, porAsistencia: [reserva] });
    await expect(job.handle()).resolves.toMatchObject({ enviados: 1 });
    expect(correo.send).toHaveBeenCalledWith('ana@correo.cl', expect.any(String), expect.stringContaining('BIENVENIDA10'), expect.any(Object));
  });

  /*
   * El cupon sale solo a quien pidio beneficios.
   *
   * Salia a todo el que asistiera, hubiera aceptado o no: un descuento es publicidad, y mandarla
   * a quien no la pidio es lo que la ley no permite. La condicion vive en la consulta, asi que se
   * comprueba ahi: una prueba sobre el resultado no distinguiria un filtro de una coincidencia.
   */
  it('sólo lo pide para quien aceptó recibir beneficios', async () => {
    const { job, reservas } = trabajo({ ajustes: encendido, porAsistencia: [reserva] });
    await job.handle();
    expect(reservas.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ marketingConsentAt: expect.anything() }),
    }));
  });

  it('lleva el enlace de baja en el pie y en la cabecera del mensaje', async () => {
    // El enlace se arma sobre la dirección pública: sin ella no hay a dónde mandar a nadie.
    const antes = process.env.APP_PUBLIC_URL;
    process.env.APP_PUBLIC_URL = 'https://cuartel.espartanos.cl';
    const { job, correo } = trabajo({ ajustes: encendido, porAsistencia: [reserva] });
    await job.handle();
    if (antes === undefined) delete process.env.APP_PUBLIC_URL; else process.env.APP_PUBLIC_URL = antes;
    const [, , html, opciones] = correo.send.mock.calls[0] as [string, string, string, { bajaUrl?: string }];
    expect(html).toContain('Dejar de recibir estos correos');
    expect(opciones.bajaUrl).toContain('tok-123');
    // Lleva de qué correo salió, para dejar constancia de desde dónde se pidió la baja.
    expect(opciones.bajaUrl).toContain('email.coupon');
  });

  it('si su ficha no aparece, el cupón sale igual sin el enlace', async () => {
    const { job, correo, suscriptores } = trabajo({ ajustes: encendido, porAsistencia: [reserva] });
    suscriptores.findOne.mockResolvedValue(null);
    await expect(job.handle()).resolves.toMatchObject({ enviados: 1 });
    const [, , , opciones] = correo.send.mock.calls[0] as [string, string, string, { bajaUrl?: string }];
    expect(opciones.bajaUrl).toBeUndefined();
  });

  it('con el interruptor apagado no lleva enlace, pero el cupón llega', async () => {
    const { job, correo } = trabajo({ ajustes: { ...encendido, 'email.coupon_unsubscribe': false }, porAsistencia: [reserva] });
    await expect(job.handle()).resolves.toMatchObject({ enviados: 1 });
    const [, , html, opciones] = correo.send.mock.calls[0] as [string, string, string, { bajaUrl?: string }];
    expect(opciones.bajaUrl).toBeUndefined();
    expect(html).not.toContain('Dejar de recibir estos correos');
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
