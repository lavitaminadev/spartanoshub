import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnviosDeCampanaService } from '../../../src/modules/marketing/envios-de-campana.service';
import { EstadoDeSuscripcion } from '../../../src/modules/marketing/suscriptor.entity';

/*
 * La bandeja que despacha las campañas.
 *
 * Aquí vive lo que antes se hacía dentro del botón y no cabía. Lo que se comprueba es lo que
 * distingue a esta cola de las otras dos: que el correo lleve su enlace de baja, que una baja
 * ocurrida **entre** el encolado y el envío se respete, y que un rebote definitivo no se repita
 * tres veces contra una dirección que no existe.
 */
function servicio(opciones: {
  suscriptor?: Record<string, unknown> | null;
  campana?: Record<string, unknown> | null;
  excluido?: 'local' | 'todas' | null;
  enviaBien?: boolean;
} = {}) {
  const suscriptor = opciones.suscriptor === undefined
    ? {
      id: 's-1', email: 'ana@correo.cl', name: 'Ana', unsubscribeToken: 't-1',
      clientId: 'c-casa', organizationId: 'org-1', status: EstadoDeSuscripcion.SUSCRITO,
      puedeRecibirCampana: () => true,
    }
    : opciones.suscriptor;

  const campana = opciones.campana === undefined
    ? { id: 'camp-1', asunto: 'Hola {{nombre}}', cuerpo: 'Tenemos algo para ti.' }
    : opciones.campana;

  const repository = {
    createQueryBuilder: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(), into: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(), orIgnore: vi.fn().mockReturnThis(),
      execute: vi.fn(async () => ({})),
      select: vi.fn().mockReturnThis(), addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(), groupBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn(async () => []),
    })),
    update: vi.fn(async () => ({ affected: 1 })),
  };
  const campanas = { findOne: vi.fn(async () => campana), find: vi.fn(async () => []), update: vi.fn(async () => ({})) };
  const suscriptores = { findOne: vi.fn(async () => suscriptor) };
  const listaDeCorreo = { exclusionDe: vi.fn(async () => opciones.excluido ?? null) };
  const correo = { send: vi.fn(async () => opciones.enviaBien ?? true) };
  const parametros = { get: vi.fn(async () => true) };

  return {
    srv: new EnviosDeCampanaService(
      repository as never, campanas as never, suscriptores as never,
      listaDeCorreo as never, correo as never, parametros as never,
    ),
    repository, correo, campanas,
  };
}

/** Acceso a los métodos protegidos, que es justo lo que hay que comprobar. */
const interno = (srv: EnviosDeCampanaService) => srv as unknown as {
  send(item: unknown): Promise<void>;
  expirationReason(item: unknown): Promise<string | null>;
  classifyFailure(error: unknown): { retryable: boolean };
};

const fila = { id: 'e-1', organizationId: 'org-1', campanaId: 'camp-1', suscriptorId: 's-1', email: 'ana@correo.cl' };

describe('la bandeja de campañas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_PUBLIC_URL = 'https://cuartel.espartanos.cl';
  });

  it('manda con el enlace de baja de esa persona, no uno genérico', async () => {
    const { srv, correo } = servicio();

    await interno(srv).send(fila);

    const [destino, asunto, , opciones] = correo.send.mock.calls[0];
    expect(destino).toBe('ana@correo.cl');
    expect(asunto).toBe('Hola Ana');
    expect(opciones.bajaUrl).toContain('t-1');
  });

  it('si el servidor de correo no lo acepta, lanza: la fila no se da por enviada', async () => {
    const { srv } = servicio({ enviaBien: false });

    await expect(interno(srv).send(fila)).rejects.toThrow();
  });

  /*
   * Lo que justifica que la comprobación viva pegada al envío y no al botón.
   *
   * Entre que se aprieta «Enviar» y sale el último correo pasan minutos. En ese rato alguien puede
   * darse de baja desde un correo anterior, y el artículo 28 B no da margen: pedida la suspensión,
   * los envíos siguientes quedan prohibidos.
   */
  describe('una baja entre el encolado y el envío', () => {
    it('se respeta si se dio de baja', async () => {
      const { srv } = servicio({
        suscriptor: { id: 's-1', email: 'ana@correo.cl', status: EstadoDeSuscripcion.BAJA, puedeRecibirCampana: () => true },
      });

      await expect(interno(srv).expirationReason(fila)).resolves.toBe('Se dio de baja antes de que saliera');
    });

    it('se respeta si pidió no recibir nunca más', async () => {
      const { srv } = servicio({ excluido: 'local' });

      await expect(interno(srv).expirationReason(fila)).resolves.toBe('Pidió no recibir más antes de que saliera');
    });

    it('no se escribe a una ficha que ya no existe', async () => {
      const { srv } = servicio({ suscriptor: null });

      await expect(interno(srv).expirationReason(fila)).resolves.toBe('La ficha ya no existe');
    });

    it('deja pasar a quien sigue suscrito', async () => {
      const { srv } = servicio();

      await expect(interno(srv).expirationReason(fila)).resolves.toBeNull();
    });
  });

  /*
   * Casi nada se reintenta: al otro lado hay una persona, no una API que vuelve.
   */
  it('reintenta lo que suena a problema del momento', () => {
    const { srv } = servicio();
    expect(interno(srv).classifyFailure(new Error('ETIMEDOUT')).retryable).toBe(true);
    expect(interno(srv).classifyFailure(new Error('El servidor de correo no aceptó el mensaje')).retryable).toBe(true);
  });

  it('no insiste contra una dirección que no existe', () => {
    const { srv } = servicio();
    expect(interno(srv).classifyFailure(new Error('550 mailbox unavailable')).retryable).toBe(false);
  });

  it('a quien no tiene token no se le encola: sería un correo sin salida', async () => {
    const { srv, repository } = servicio();

    const encolados = await srv.encolar(
      { id: 'camp-1', organizationId: 'org-1' } as never,
      [{ id: 's-9', email: 'sin@token.cl', unsubscribeToken: null }] as never,
    );

    expect(encolados).toBe(0);
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('la constancia no se borra: esta bandeja no limpia lo procesado', async () => {
    const { srv } = servicio();

    await expect(srv.cleanup()).resolves.toEqual({ deleted: 0 });
  });
});
