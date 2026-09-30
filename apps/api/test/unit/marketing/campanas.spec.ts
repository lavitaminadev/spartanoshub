import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampanasService } from '../../../src/modules/marketing/campanas.service';
import { EstadoDeCampana } from '../../../src/modules/marketing/campana.entity';

/*
 * Mandar una campaña.
 *
 * Es el único correo del sistema que nadie pidió individualmente, y el único error de aquí que no
 * se deshace: enviado, enviado está. Lo que se comprueba es que no salga dos veces, que no salga
 * sin enlace de baja, y que un fallo con una dirección no impida el resto.
 */
function servicio(opciones: {
  campana?: Record<string, unknown>;
  suscritos?: Array<Record<string, unknown>>;
  enviaBien?: boolean;
  tomada?: boolean;
} = {}) {
  const campana = opciones.campana ?? {
    id: 'camp-1', organizationId: 'org-1', clientId: 'c-casa',
    asunto: 'Hola {{nombre}}', cuerpo: 'Tenemos algo para ti.', estado: EstadoDeCampana.BORRADOR,
  };
  const repo = {
    findOne: vi.fn(async () => campana),
    update: vi.fn(async () => ({ affected: opciones.tomada === false ? 0 : 1 })),
    save: vi.fn(async (fila: unknown) => fila),
    create: vi.fn((fila: unknown) => fila),
    remove: vi.fn(async () => undefined),
    find: vi.fn(async () => [campana]),
  };
  const suscriptores = {
    suscritos: vi.fn(async () => opciones.suscritos ?? [
      { id: 's-1', email: 'ana@correo.cl', name: 'Ana', unsubscribeToken: 't-1', clientId: 'c-casa', organizationId: 'org-1' },
      { id: 's-2', email: 'bea@correo.cl', name: null, unsubscribeToken: 't-2', clientId: 'c-casa', organizationId: 'org-1' },
    ]),
  };
  const correo = { send: vi.fn(async () => opciones.enviaBien ?? true) };
  // Ningún interruptor apagado: el resolutor devuelve el valor por defecto.
  const parametros = { get: vi.fn(async () => true) };
  return {
    srv: new CampanasService(repo as never, suscriptores as never, correo as never, parametros as never),
    repo, correo, suscriptores,
  };
}

describe('campañas de correo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_PUBLIC_URL = 'https://cuartel.espartanos.cl';
  });

  it('escribe a cada suscrito y cuenta los que salieron', async () => {
    const { srv, correo } = servicio();

    const resultado = await srv.enviar('camp-1', 'org-1');

    expect(correo.send).toHaveBeenCalledTimes(2);
    expect(resultado).toEqual({ destinatarios: 2, enviados: 2, fallidos: 0 });
  });

  it('cada correo lleva su enlace de baja, que es individual', async () => {
    const { srv, correo } = servicio();

    await srv.enviar('camp-1', 'org-1');

    const [, , , opcionesDeAna] = correo.send.mock.calls[0];
    const [, , , opcionesDeBea] = correo.send.mock.calls[1];
    expect(opcionesDeAna.bajaUrl).toContain('t-1');
    expect(opcionesDeBea.bajaUrl).toContain('t-2');
    expect(opcionesDeAna.bajaUrl).not.toEqual(opcionesDeBea.bajaUrl);
  });

  it('a quien no tiene token no se le escribe: sería un correo sin salida', async () => {
    const { srv, correo } = servicio({
      suscritos: [{ id: 's-3', email: 'sin@token.cl', name: 'Sin', unsubscribeToken: null, organizationId: 'org-1' }],
    });

    const resultado = await srv.enviar('camp-1', 'org-1');

    expect(correo.send).not.toHaveBeenCalled();
    expect(resultado.enviados).toBe(0);
  });

  it('rellena el nombre en el asunto, y sin nombre no deja el hueco', async () => {
    const { srv, correo } = servicio();

    await srv.enviar('camp-1', 'org-1');

    expect(correo.send.mock.calls[0][1]).toBe('Hola Ana');
    expect(correo.send.mock.calls[1][1]).toBe('Hola');
  });

  it('una campaña ya enviada no se vuelve a mandar', async () => {
    const { srv, correo } = servicio({
      campana: { id: 'camp-1', organizationId: 'org-1', estado: EstadoDeCampana.ENVIADA, asunto: 'a', cuerpo: 'b' },
    });

    await expect(srv.enviar('camp-1', 'org-1')).rejects.toBeInstanceOf(ConflictException);
    expect(correo.send).not.toHaveBeenCalled();
  });

  it('si otra petición ganó la carrera, ésta no escribe un solo correo', async () => {
    // `update` no afectó ninguna fila: alguien más ya la pasó a «enviando».
    const { srv, correo } = servicio({ tomada: false });

    await expect(srv.enviar('camp-1', 'org-1')).rejects.toBeInstanceOf(ConflictException);
    expect(correo.send).not.toHaveBeenCalled();
  });

  it('un fallo con una dirección no detiene al resto, y queda en la cuenta', async () => {
    const { srv, correo } = servicio();
    correo.send.mockRejectedValueOnce(new Error('rebotó'));

    const resultado = await srv.enviar('camp-1', 'org-1');

    expect(resultado).toEqual({ destinatarios: 2, enviados: 1, fallidos: 1 });
  });

  it('la cuenta previa sale de la misma consulta que arma los destinatarios', async () => {
    const { srv, suscriptores } = servicio();

    await expect(srv.destinatarios('org-1', 'c-casa')).resolves.toBe(2);
    expect(suscriptores.suscritos).toHaveBeenCalledWith('org-1', 'c-casa');
  });

  it('«agencia» significa la lista sin empresa, también al contar', async () => {
    const { srv, suscriptores } = servicio();

    await srv.destinatarios('org-1', 'agencia');

    expect(suscriptores.suscritos).toHaveBeenCalledWith('org-1', null);
  });

  it('el texto de una campaña enviada no se corrige: es la constancia de lo que salió', async () => {
    const { srv } = servicio({
      campana: { id: 'camp-1', organizationId: 'org-1', estado: EstadoDeCampana.ENVIADA, asunto: 'a', cuerpo: 'b' },
    });

    await expect(srv.editar('camp-1', 'org-1', { asunto: 'otro' })).rejects.toBeInstanceOf(ConflictException);
    await expect(srv.borrar('camp-1', 'org-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
