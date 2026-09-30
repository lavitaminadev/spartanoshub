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
  const envios = {
    encolar: vi.fn(async (_campana: unknown, destinatarios: unknown[]) => destinatarios.length),
    avanceDe: vi.fn(async () => ({ enviados: 0, pendientes: 0, fallidos: 0 })),
  };
  // Ningún interruptor apagado: el resolutor devuelve el valor por defecto.
  const parametros = { get: vi.fn(async () => true) };
  return {
    srv: new CampanasService(repo as never, suscriptores as never, envios as never, parametros as never),
    repo, envios, suscriptores,
  };
}

describe('campañas de correo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_PUBLIC_URL = 'https://cuartel.espartanos.cl';
  });

  /*
   * El botón encola, no manda.
   *
   * Doscientos correos no caben en una petición: el `curl` del cron corta al minuto y Passenger
   * antes, así que mandando aquí la lista se cortaba a la mitad y la campaña quedaba en «enviando»
   * sin forma de reanudarla. Quien manda es la bandeja, por tandas.
   */
  it('encola a los suscritos y no manda ni un correo', async () => {
    const { srv, envios } = servicio();

    const resultado = await srv.enviar('camp-1', 'org-1');

    expect(envios.encolar).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual({ destinatarios: 2, enviados: 0, fallidos: 0, enCola: true });
  });

  it('guarda cuántos quedaron en cola, que es a cuántos se le escribirá', async () => {
    const { srv, repo } = servicio();

    await srv.enviar('camp-1', 'org-1');

    expect(repo.update).toHaveBeenLastCalledWith('camp-1', { destinatarios: 2 });
  });

  it('con la lista vacía no se encola nada ni se marca como enviando', async () => {
    const { srv, repo, envios } = servicio({ suscritos: [] });

    await expect(srv.enviar('camp-1', 'org-1')).rejects.toBeInstanceOf(ConflictException);

    expect(envios.encolar).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('una campaña ya enviada no se vuelve a encolar', async () => {
    const { srv, envios } = servicio({
      campana: { id: 'camp-1', organizationId: 'org-1', estado: EstadoDeCampana.ENVIADA, asunto: 'a', cuerpo: 'b' },
    });

    await expect(srv.enviar('camp-1', 'org-1')).rejects.toBeInstanceOf(ConflictException);
    expect(envios.encolar).not.toHaveBeenCalled();
  });

  it('si otra petición ganó la carrera, ésta no encola nada', async () => {
    // `update` no afectó ninguna fila: alguien más ya la pasó a «enviando».
    const { srv, envios } = servicio({ tomada: false });

    await expect(srv.enviar('camp-1', 'org-1')).rejects.toBeInstanceOf(ConflictException);
    expect(envios.encolar).not.toHaveBeenCalled();
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

  /*
   * La vista previa.
   *
   * Compone con la misma función que el envío, así que lo que se ve es lo que sale. Y lleva el
   * pie de baja: es lo que distingue una campaña de cualquier otro correo, y enseñarla sin él
   * mostraría algo que no existe.
   */
  it('la vista previa lleva el pie de baja y rellena el nombre', () => {
    const { srv } = servicio();

    const previa = srv.vistaPrevia('Hola {{nombre}}', 'Tenemos algo para ti.');

    expect(previa.subject).toBe('Hola Ana');
    expect(previa.html).toContain('/marketing/suscriptores/baja/');
  });

  it('el texto de una campaña enviada no se corrige: es la constancia de lo que salió', async () => {
    const { srv } = servicio({
      campana: { id: 'camp-1', organizationId: 'org-1', estado: EstadoDeCampana.ENVIADA, asunto: 'a', cuerpo: 'b' },
    });

    await expect(srv.editar('camp-1', 'org-1', { asunto: 'otro' })).rejects.toBeInstanceOf(ConflictException);
    await expect(srv.borrar('camp-1', 'org-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
