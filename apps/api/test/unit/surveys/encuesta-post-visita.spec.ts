/**
 * Qué se garantiza: sólo se encuesta a quien asistió, una vez, dentro de su ventana, con una
 * encuesta activa de la misma empresa; y lo que no salió se reintenta en vez de darse por enviado.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EncuestaPostVisitaJob, encuestaUtil } from '../../../src/core/jobs/cron/encuesta-post-visita.job';

const HORA = 3_600_000;

function armar(opciones: { ajustes?: Record<string, unknown>; encuesta?: Record<string, unknown> | null; enviado?: boolean; finHaceHoras?: number } = {}) {
  const ahora = Date.now();
  const reserva = {
    id: 'reserva-1', formId: 'form-1', status: 'attended', guestName: 'Camila Rojas', guestEmail: 'camila@example.test',
    startsAt: new Date(ahora - ((opciones.finHaceHoras ?? 5) + 2) * HORA),
    endsAt: new Date(ahora - (opciones.finHaceHoras ?? 5) * HORA),
  };
  const reservas = { find: vi.fn().mockResolvedValue([reserva]), update: vi.fn().mockResolvedValue({}) };
  const formularios = { findOne: vi.fn().mockResolvedValue({ id: 'form-1', organizationId: 'org-1', clientId: 'cliente-1', name: 'Casa Costanera', timezone: 'America/Santiago', designConfig: { supportEmail: 'hola@local.test' } }) };
  const encuestas = { findOne: vi.fn().mockResolvedValue(opciones.encuesta === undefined ? { id: 'enc-1', status: 'active', type: 'customer', clientId: 'cliente-1' } : opciones.encuesta) };
  const correo = { send: vi.fn().mockResolvedValue(opciones.enviado ?? true) };
  const valores: Record<string, unknown> = {
    'email.post_visit_survey_enabled': true,
    'email.post_visit_survey_id': 'enc-1',
    'email.post_visit_survey_hours': 3,
    ...(opciones.ajustes ?? {}),
  };
  const parametros = { get: vi.fn((clave: string) => Promise.resolve(valores[clave])) };
  const job = new EncuestaPostVisitaJob(reservas as never, formularios as never, encuestas as never, correo as never, parametros as never);
  return { job, reservas, correo };
}

describe('encuesta post-visita', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'secreto-de-prueba';
    process.env.APP_PUBLIC_URL = 'https://cuartel.example.test/';
  });

  it('envía la encuesta y marca la visita como encuestada', async () => {
    const { job, reservas, correo } = armar();
    await expect(job.handle()).resolves.toEqual({ enviados: 1, revisados: 1 });
    expect(correo.send).toHaveBeenCalledTimes(1);
    const [destino, , html, opciones] = correo.send.mock.calls[0];
    expect(destino).toBe('camila@example.test');
    expect(html).toContain('https://cuartel.example.test/survey/enc-1?src=email&amp;i=');
    // Responder el correo llega al local, no a la agencia.
    expect(opciones).toEqual({ replyTo: 'hola@local.test' });
    expect(reservas.update).toHaveBeenCalledWith('reserva-1', { postVisitSurveySentAt: expect.any(Date) });
  });

  it('busca sólo visitas asistidas, no encuestadas y con correo', async () => {
    const { job, reservas } = armar();
    await job.handle();
    const donde = reservas.find.mock.calls[0][0].where;
    expect(donde.status).toBe('attended');
    expect(donde.postVisitSurveySentAt).toBeDefined();
    expect(donde.guestEmail).toBeDefined();
  });

  it('no envía antes de las horas configuradas', async () => {
    const { job, correo } = armar({ finHaceHoras: 1 });
    await job.handle();
    expect(correo.send).not.toHaveBeenCalled();
  });

  /* Encender el aviso no puede encuestar de golpe visitas viejas. */
  it('no envía pasado su margen', async () => {
    const { job, correo } = armar({ finHaceHoras: 3 + 48 + 2 });
    await job.handle();
    expect(correo.send).not.toHaveBeenCalled();
  });

  it('no envía si el aviso está apagado o no hay encuesta elegida', async () => {
    for (const ajustes of [{ 'email.post_visit_survey_enabled': false }, { 'email.post_visit_survey_id': '' }]) {
      const { job, correo } = armar({ ajustes });
      await job.handle();
      expect(correo.send).not.toHaveBeenCalled();
    }
  });

  it('no envía con una encuesta cerrada o inexistente', async () => {
    for (const encuesta of [null, { id: 'enc-1', status: 'closed', type: 'customer', clientId: 'cliente-1' }]) {
      const { job, correo } = armar({ encuesta });
      await job.handle();
      expect(correo.send).not.toHaveBeenCalled();
    }
  });

  it('reintenta en la siguiente pasada si el correo no salió', async () => {
    const { job, reservas } = armar({ enviado: false });
    await expect(job.handle()).resolves.toEqual({ enviados: 0, revisados: 1 });
    expect(reservas.update).not.toHaveBeenCalled();
  });

  it('no hace nada sin la dirección pública para armar el enlace', async () => {
    process.env.APP_PUBLIC_URL = '';
    const { job, reservas } = armar();
    await expect(job.handle()).resolves.toEqual({ enviados: 0, revisados: 0 });
    expect(reservas.find).not.toHaveBeenCalled();
  });
});

describe('encuestaUtil', () => {
  it('acepta una encuesta activa de clientes, general o de la misma empresa', () => {
    expect(encuestaUtil({ status: 'active', type: 'customer', clientId: null }, { clientId: 'c1' })).toBe(true);
    expect(encuestaUtil({ status: 'active', type: 'customer', clientId: 'c1' }, { clientId: 'c1' })).toBe(true);
  });

  it('rechaza la de otra empresa, la interna o la que no está activa', () => {
    expect(encuestaUtil({ status: 'active', type: 'customer', clientId: 'otra' }, { clientId: 'c1' })).toBe(false);
    expect(encuestaUtil({ status: 'active', type: 'internal', clientId: null }, { clientId: 'c1' })).toBe(false);
    expect(encuestaUtil({ status: 'draft', type: 'customer', clientId: null }, { clientId: 'c1' })).toBe(false);
  });
});
