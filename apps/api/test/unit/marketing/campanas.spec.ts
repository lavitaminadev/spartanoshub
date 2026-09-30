import { BadRequestException, ConflictException } from '@nestjs/common';
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
  cupon?: Record<string, unknown> | null;
  administradores?: Array<Record<string, unknown>>;
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
  const cupones = {
    findOne: vi.fn(async () => (opciones.cupon === undefined
      ? { code: 'VUELVE20', clientId: 'c-casa', active: true, validUntil: new Date('2030-01-01') }
      : opciones.cupon)),
  };
  const usuarios = {
    find: vi.fn(async () => opciones.administradores ?? [
      { id: 'u-1', email: 'jefe@casa.cl', name: 'Jefe' },
    ]),
  };
  return {
    srv: new CampanasService(
      repo as never, suscriptores as never, envios as never, parametros as never,
      cupones as never, usuarios as never,
    ),
    repo, envios, suscriptores, cupones, usuarios,
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

    await expect(srv.destinatarios('org-1', 'c-casa')).resolves.toMatchObject({ total: 2 });
    expect(suscriptores.suscritos).toHaveBeenCalledWith('org-1', 'c-casa');
  });

  /*
   * A cuántos, y a quiénes.
   *
   * «312 personas» no dice si son las que uno cree, y esto no se deshace. La muestra va corta a
   * propósito: sirve para reconocer la lista, no para leerla entera.
   */
  it('la cuenta previa trae unos nombres y dice de qué lista son', async () => {
    const { srv } = servicio();

    const resumen = await srv.destinatarios('org-1', 'c-casa');

    expect(resumen.muestra.length).toBeLessThanOrEqual(5);
    expect(resumen.muestra[0]).toEqual({ email: 'ana@correo.cl', nombre: 'Ana' });
    expect(resumen.deQuienes).toContain('empresa');
  });

  it('a los administradores no se les pregunta la lista de marketing', async () => {
    const { srv, suscriptores, usuarios } = servicio();

    const resumen = await srv.destinatarios('org-1', 'c-casa', 'administradores');

    expect(suscriptores.suscritos).not.toHaveBeenCalled();
    expect(usuarios.find).toHaveBeenCalled();
    expect(resumen.total).toBe(1);
    expect(resumen.deQuienes).toContain('administran');
  });

  /*
   * Escribirle a quien ya no trabaja ahí es filtrarle a un tercero lo que pasa en esa empresa.
   */
  it('a los administradores sólo se les escribe si su cuenta está activa y es de esa empresa', async () => {
    const { srv, usuarios } = servicio();

    await srv.destinatarios('org-1', 'c-casa', 'administradores');

    expect(usuarios.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org-1', clientId: 'c-casa', isActive: true }),
    }));
  });

  /*
   * El cupón se comprueba al guardar y no al enviar: un código que la caja rechaza delante del
   * cliente es peor que no ofrecer ninguno, y quien escribe la campaña tiene que enterarse
   * mientras todavía puede corregirlo.
   */
  it('acepta un cupón que existe, es de esa empresa, está activo y no ha vencido', async () => {
    const { srv } = servicio();

    const creada = await srv.crear({
      organizationId: 'org-1', clientId: 'c-casa', asunto: 'Hola', cuerpo: 'Texto', cupon: 'vuelve20',
    });

    expect(creada.cupon).toBe('VUELVE20');
    expect(creada.cuponVence).toEqual(new Date('2030-01-01'));
  });

  it.each([
    ['no existe', null],
    ['es de otra empresa', { code: 'X', clientId: 'c-otra', active: true, validUntil: null }],
    ['está desactivado', { code: 'X', clientId: 'c-casa', active: false, validUntil: null }],
    ['ya venció', { code: 'X', clientId: 'c-casa', active: true, validUntil: new Date('2020-01-01') }],
  ])('rechaza el cupón que %s', async (_motivo, cupon) => {
    const { srv } = servicio({ cupon });

    await expect(srv.crear({
      organizationId: 'org-1', clientId: 'c-casa', asunto: 'Hola', cuerpo: 'Texto', cupon: 'X',
    })).rejects.toBeInstanceOf(BadRequestException);
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
