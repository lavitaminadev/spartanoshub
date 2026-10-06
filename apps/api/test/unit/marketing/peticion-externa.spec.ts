import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SuscriptoresService } from '../../../src/modules/marketing/suscriptores.service';
import { EstadoDeSuscripcion } from '../../../src/modules/marketing/suscriptor.entity';

/*
 * Las peticiones de baja que no vienen del enlace del correo.
 *
 * El caso que obliga es el del SERNAC: el consumidor registra la empresa en «No Molestar» y el
 * envío queda prohibido desde ese registro (Decreto 62 de 2019, art. 5), mientras el aviso por
 * correo recién sale el día hábil siguiente. De ahí que se pueda anotar con fecha anterior a hoy, y
 * que la fecha guardada sea siempre la más antigua. También entra por acá quien lo pide a soporte.
 */
function servicio(fichas: Array<Record<string, unknown>> = []) {
  const repo = {
    find: vi.fn(async () => fichas),
    findOne: vi.fn(async () => null),
    save: vi.fn(async (fila: unknown) => fila),
    create: vi.fn((fila: unknown) => fila),
  };
  const exclusiones = {
    find: vi.fn(async () => []),
    findOne: vi.fn(async () => null),
    save: vi.fn(async (fila: unknown) => fila),
    create: vi.fn((fila: unknown) => fila),
    count: vi.fn(async () => 0),
  };
  return { srv: new SuscriptoresService(repo as never, exclusiones as never), repo, exclusiones };
}

const ficha = () => ({ id: 's-1', email: 'ana@correo.cl', clientId: 'c-casa', status: EstadoDeSuscripcion.SUSCRITO });

describe('petición de baja recibida por fuera', () => {
  beforeEach(() => vi.clearAllMocks());

  it('da de baja las fichas y deja la exclusión con el origen', async () => {
    const { srv, repo, exclusiones } = servicio([ficha()]);

    const resultado = await srv.anotarPeticionExterna('org-1', ' Ana@Correo.CL ', 'todas', null, 'Aviso SERNAC 12-03-2026');

    expect(resultado).toEqual({ fichasDeBaja: 1, email: 'ana@correo.cl' });
    expect(repo.save).toHaveBeenCalledWith([expect.objectContaining({
      status: EstadoDeSuscripcion.BAJA,
      unsubscribedScope: 'todas',
      unsubscribedFrom: 'Aviso SERNAC 12-03-2026',
    })]);
    expect(exclusiones.create).toHaveBeenCalledWith(expect.objectContaining({
      clientId: null, alcance: 'todas', origen: 'Aviso SERNAC 12-03-2026',
    }));
  });

  /*
   * Lo importante del caso SERNAC: la persona puede no estar en ninguna lista. La petición vale
   * igual, y la exclusión impide que entre después por una reserva.
   */
  it('vale aunque la dirección no esté en ninguna lista', async () => {
    const { srv, exclusiones } = servicio([]);

    const resultado = await srv.anotarPeticionExterna('org-1', 'nadie@correo.cl', 'todas', null, 'Llamó por teléfono');

    expect(resultado.fichasDeBaja).toBe(0);
    expect(exclusiones.create).toHaveBeenCalled();
  });

  /* Sin origen no se anota: es lo único que explica por qué quedó excluida sin hacer clic en nada. */
  it('exige decir de dónde vino la petición', async () => {
    const { srv } = servicio([ficha()]);

    await expect(srv.anotarPeticionExterna('org-1', 'ana@correo.cl', 'todas', null, '   '))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('una baja de una sola empresa tiene que decir cuál', async () => {
    const { srv } = servicio([ficha()]);

    await expect(srv.anotarPeticionExterna('org-1', 'ana@correo.cl', 'local', null, 'Correo a soporte'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('una dirección sin arroba no se anota', async () => {
    const { srv } = servicio();

    await expect(srv.anotarPeticionExterna('org-1', 'ana', 'todas', null, 'SERNAC'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  /* La baja ya anotada conserva su fecha: es la que vale si alguien reclama por los envíos. */
  it('no pisa la fecha de una baja anterior', async () => {
    const yaDeBaja = { ...ficha(), status: EstadoDeSuscripcion.BAJA, unsubscribedScope: 'local', unsubscribedAt: new Date('2026-01-01') };
    const { srv, repo } = servicio([yaDeBaja]);

    const resultado = await srv.anotarPeticionExterna('org-1', 'ana@correo.cl', 'todas', null, 'SERNAC');

    expect(resultado.fichasDeBaja).toBe(0);
    expect(repo.save).not.toHaveBeenCalled();
  });

  /*
   * La fecha con que se anota.
   *
   * Decreto 62 de 2019, art. 5: la prohibición corre desde que la persona registró la solicitud, y
   * su inciso 2 hace regir «lo que primero ocurra» cuando lo pidió por dos vías. El aviso llega
   * siempre después, así que poder anotar una fecha anterior a hoy no es una comodidad: es lo que
   * decide si un correo enviado en medio fue lícito.
   */
  it('guarda la fecha en que la persona lo pidió, no la de hoy', async () => {
    const { srv, repo, exclusiones } = servicio([ficha()]);

    await srv.anotarPeticionExterna('org-1', 'ana@correo.cl', 'todas', null, 'Aviso SERNAC', '2026-03-12');

    const guardada = (repo.save.mock.calls[0][0] as Array<{ unsubscribedAt: Date }>)[0].unsubscribedAt;
    expect(guardada.toISOString().slice(0, 10)).toBe('2026-03-12');
    expect(exclusiones.create).toHaveBeenCalledWith(expect.objectContaining({
      pedidaEl: expect.any(Date),
    }));
  });

  it('corrige hacia atrás la fecha de una baja que ya estaba anotada después', async () => {
    const tarde = { ...ficha(), status: EstadoDeSuscripcion.SUSCRITO, unsubscribedAt: new Date('2026-04-01T12:00:00Z') };
    const { srv, repo } = servicio([tarde]);

    await srv.anotarPeticionExterna('org-1', 'ana@correo.cl', 'todas', null, 'Llamó el 12 de marzo', '2026-03-12');

    const guardada = (repo.save.mock.calls[0][0] as Array<{ unsubscribedAt: Date }>)[0].unsubscribedAt;
    expect(guardada.toISOString().slice(0, 10)).toBe('2026-03-12');
  });

  /* Una fecha futura sólo puede ser un error de tipeo, y adelantarla no beneficia a nadie. */
  it('ignora una fecha futura o ilegible y toma hoy', async () => {
    const hoy = new Date().toISOString().slice(0, 10);

    for (const malas of ['2099-01-01', 'ayer', '12-03-2026']) {
      const { srv, repo } = servicio([ficha()]);
      await srv.anotarPeticionExterna('org-1', 'ana@correo.cl', 'todas', null, 'SERNAC', malas);
      const guardada = (repo.save.mock.calls[0][0] as Array<{ unsubscribedAt: Date }>)[0].unsubscribedAt;
      expect(guardada.toISOString().slice(0, 10)).toBe(hoy);
    }
  });
});
