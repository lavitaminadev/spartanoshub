import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicSurveyFlowService } from '../../../src/modules/surveys/public-survey-flow.service';

/*
 * Una respuesta enviada queda como se envió, y el local se entera una vez.
 *
 * Antes, volver al enlace de la invitación otro día sobrescribía la nota que se dio en su momento,
 * el token —que no caduca— permitía reescribir una respuesta terminada meses después, y cada
 * corrección del mensaje al equipo mandaba otro correo al local.
 */
const TOKEN = 'token-de-la-respuesta';
const hash = createHash('sha256').update(TOKEN).digest('hex');

const encuesta = {
  id: 'enc-1',
  organizationId: 'org-1',
  clientId: null,
  status: 'active',
  title: 'Tu visita',
  questions: [{ id: 'nota', type: 'rating', question: '¿Cómo te fue?', required: true }],
};

function servicio(respuesta: Record<string, unknown>) {
  const surveys = { findOne: vi.fn().mockResolvedValue(encuesta), query: vi.fn().mockResolvedValue([]) };
  const responses = {
    createQueryBuilder: vi.fn(() => ({
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(respuesta),
    })),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const dataSource = {
    // El local de la reserva, para el aviso al equipo.
    query: vi.fn().mockResolvedValue([{ name: 'Casa Costanera', team_notifications: '["equipo@local.cl"]', design_config: '{}' }]),
    transaction: vi.fn(async (trabajo: (manager: unknown) => unknown) => trabajo({
      findOne: vi.fn().mockResolvedValue(respuesta),
      update: vi.fn(),
      save: vi.fn(),
      create: vi.fn((_: unknown, datos: unknown) => datos),
      increment: vi.fn(),
    })),
  };
  const correo = { send: vi.fn().mockResolvedValue(true) };
  // Sin plantilla guardada: se usa el texto de fábrica y el aviso está encendido.
  const parametros = { get: vi.fn().mockResolvedValue(null) };
  /*
   * Las casillas del equipo se piden por local y por tipo de aviso. Aqui devuelve lo heredado del
   * formulario, que es lo que hacia el codigo anterior: el aviso tiene que seguir saliendo igual
   * para un local que todavia no ha pasado sus direcciones a la tabla nueva.
   */
  const avisos = { para: vi.fn(async (_org, _cliente, _tipo, heredadas) => heredadas) };
  const flujo = new PublicSurveyFlowService(surveys as never, responses as never, dataSource as never, correo as never, parametros as never, avisos as never);
  return { flujo, responses, correo, avisos };
}

/** El aviso al local sale fuera de la respuesta: se deja correr antes de mirar. */
const esperarAvisos = () => new Promise((resolver) => setImmediate(resolver));

describe('respuesta de encuesta ya enviada', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no se puede reescribir con el token una vez terminada', async () => {
    const { flujo, responses } = servicio({ id: 'r-1', editTokenHash: hash, completedAt: new Date('2026-09-01'), answers: { nota: 5 } });

    await expect(flujo.completar('enc-1', 'r-1', TOKEN, { answers: {}, terminar: true })).rejects.toThrow(ConflictException);
    expect(responses.update).not.toHaveBeenCalled();
  });

  it('mientras no está terminada, se sigue completando', async () => {
    const { flujo, responses } = servicio({ id: 'r-1', editTokenHash: hash, completedAt: null, answers: { nota: 2 } });

    await flujo.completar('enc-1', 'r-1', TOKEN, { terminar: true });
    expect(responses.update).toHaveBeenCalled();
  });

  /*
   * Volver al enlace de la invitación otro día sobrescribía la nota dada en su momento, y con ella
   * los resultados ya leídos.
   */
  it('volver a la invitación de una visita ya respondida no pisa la nota', async () => {
    const { flujo } = servicio({ id: 'r-1', completedAt: new Date('2026-09-01'), rating: 5, answers: { nota: 5 } });
    const conInvitacion = flujo as unknown as { quienResponde: () => Promise<unknown> };
    conInvitacion.quienResponde = async () => ({ reservationId: 'reserva-1', nombre: 'Ana', correo: 'ana@correo.cl' });

    await expect(flujo.iniciar('enc-1', 1, 'invitacion')).rejects.toThrow(/Ya nos dejaste tu opinión/);
  });
});

describe('aviso al local por el mensaje de una encuesta', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sale la primera vez que la persona escribe', async () => {
    const { flujo, correo } = servicio({ id: 'r-1', editTokenHash: hash, completedAt: null, reservationId: 'reserva-1', teamMessage: null, answers: { nota: 2 } });

    await flujo.completar('enc-1', 'r-1', TOKEN, { teamMessage: 'La mesa estaba fría' });
    await esperarAvisos();

    expect(correo.send).toHaveBeenCalledTimes(1);
  });

  /*
   * Cada corrección del texto mandaba otro correo: con el límite de la ruta, hasta veinte por
   * minuto al mismo local. El texto corregido igual se guarda.
   */
  it('corregir el mensaje lo guarda sin volver a avisar', async () => {
    const { flujo, correo, responses } = servicio({ id: 'r-1', editTokenHash: hash, completedAt: null, reservationId: 'reserva-1', teamMessage: 'La mesa estaba fría', answers: { nota: 2 } });

    await flujo.completar('enc-1', 'r-1', TOKEN, { teamMessage: 'La mesa estaba fría y tardaron' });
    await esperarAvisos();

    expect(correo.send).not.toHaveBeenCalled();
    expect(responses.update).toHaveBeenCalledWith({ id: 'r-1' }, expect.objectContaining({ teamMessage: 'La mesa estaba fría y tardaron' }));
  });

  /*
   * El caso que no avisaba a nadie.
   *
   * Sin reserva —la encuesta del QR en la carta, la del mesón— la función salía en la primera línea
   * y el mensaje se quedaba en Resultados esperando que alguien abriera la pantalla. Las casillas
   * son del local, así que con la empresa de la encuesta ya se sabe a quién escribirle.
   */
  it('una encuesta abierta por QR, sin reserva, también avisa al equipo del local', async () => {
    const { flujo, correo, avisos } = servicio({ id: 'r-1', editTokenHash: hash, completedAt: null, reservationId: null, teamMessage: null, answers: { nota: 2 } });
    avisos.para.mockResolvedValue(['garzon@local.cl']);

    await flujo.completar('enc-1', 'r-1', TOKEN, { teamMessage: 'Faltaba una silla' });
    await esperarAvisos();

    expect(avisos.para).toHaveBeenCalledWith('org-1', null, 'encuestas', []);
    expect(correo.send).toHaveBeenCalledTimes(1);
    expect(correo.send).toHaveBeenCalledWith('garzon@local.cl', expect.any(String), expect.any(String), undefined);
  });

  /* Sin nadie anotado no se manda nada: no hay destinatario por descarte al que escribirle. */
  it('sin casillas del equipo ni correo de soporte no sale ningún aviso', async () => {
    const { flujo, correo, avisos } = servicio({ id: 'r-1', editTokenHash: hash, completedAt: null, reservationId: null, teamMessage: null, answers: { nota: 2 } });
    avisos.para.mockResolvedValue([]);

    await flujo.completar('enc-1', 'r-1', TOKEN, { teamMessage: 'Nada grave' });
    await esperarAvisos();

    expect(correo.send).not.toHaveBeenCalled();
  });
});
