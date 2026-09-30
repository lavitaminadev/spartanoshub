import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinatariosDeAvisosService } from '../../../src/core/notifications/destinatarios-de-avisos.service';
import { DestinatarioDeAvisos } from '../../../src/core/notifications/destinatario-de-avisos.entity';

/*
 * A quién del equipo le llega cada aviso.
 *
 * El garzón y la cajera no tienen cuenta: reciben un correo y hacen su trabajo. Lo que se comprueba
 * es que cada uno reciba lo suyo —el aviso de un evento lleva el teléfono de quien lo pidió— y que
 * nadie pierda avisos por el cambio: las direcciones del campo antiguo siguen recibiendo todo.
 */
function fila(datos: Partial<DestinatarioDeAvisos>): DestinatarioDeAvisos {
  return Object.assign(new DestinatarioDeAvisos(), datos);
}

function servicio(filas: DestinatarioDeAvisos[] = []) {
  const repo = {
    find: vi.fn(async () => filas),
    findOne: vi.fn(async () => null),
    save: vi.fn(async (fila: unknown) => fila),
    create: vi.fn((fila: unknown) => fila),
    remove: vi.fn(async () => undefined),
  };
  return { srv: new DestinatariosDeAvisosService(repo as never), repo };
}

describe('destinatarios de los avisos del equipo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('a cada uno lo suyo: el garzón no recibe el aviso de los eventos', async () => {
    const { srv } = servicio([
      fila({ email: 'garzon@local.cl', tipos: ['reservas'] }),
      fila({ email: 'gerente@local.cl', tipos: ['reservas', 'grupos'] }),
    ]);

    await expect(srv.para('org-1', 'c-casa', 'reservas')).resolves.toEqual(['garzon@local.cl', 'gerente@local.cl']);
    await expect(srv.para('org-1', 'c-casa', 'grupos')).resolves.toEqual(['gerente@local.cl']);
  });

  /*
   * Es el estado de quien se va de vacaciones: se le dejan de mandar avisos sin borrar la fila, así
   * que volver a activarlo no obliga a pedirle otra vez la dirección.
   */
  it('sin ningún tipo marcado no recibe nada, y la fila sigue existiendo', async () => {
    const { srv } = servicio([fila({ email: 'barra@local.cl', tipos: [] })]);

    await expect(srv.para('org-1', 'c-casa', 'reservas')).resolves.toEqual([]);
  });

  /*
   * Quien tenía direcciones en el campo del formulario las venía recibiendo todas. Quitarle avisos
   * al pasar por aquí sería apagárselos en silencio, que es peor que no haber cambiado nada.
   */
  it('las direcciones heredadas del formulario reciben todos los tipos', async () => {
    const { srv } = servicio([]);

    for (const tipo of ['reservas', 'grupos', 'operacion'] as const) {
      await expect(srv.para('org-1', 'c-casa', tipo, ['viejo@local.cl'])).resolves.toEqual(['viejo@local.cl']);
    }
  });

  it('la misma dirección anotada y heredada no recibe el correo dos veces', async () => {
    const { srv } = servicio([fila({ email: 'jefe@local.cl', tipos: ['reservas'] })]);

    await expect(srv.para('org-1', 'c-casa', 'reservas', ['JEFE@local.cl'])).resolves.toEqual(['jefe@local.cl']);
  });

  /* Sin local no hay equipo al que preguntar, y no se cae hacia ninguna lista de la organización. */
  it('sin empresa sólo quedan las heredadas', async () => {
    const { srv, repo } = servicio([fila({ email: 'alguien@local.cl', tipos: ['reservas'] })]);

    await expect(srv.para('org-1', null, 'reservas', ['formulario@local.cl'])).resolves.toEqual(['formulario@local.cl']);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('descarta lo que no sea una dirección de correo', async () => {
    const { srv } = servicio([]);

    await expect(srv.para('org-1', 'c-casa', 'reservas', ['sin-arroba', '  bien@local.cl '])).resolves.toEqual(['bien@local.cl']);
  });

  it('una dirección sin arroba no se anota', async () => {
    const { srv } = servicio();

    await expect(srv.guardar('org-1', 'c-casa', { email: 'garzon' })).rejects.toBeInstanceOf(BadRequestException);
  });

  /* Un tipo que dejó de existir no puede impedir que se corrija la fila ni resolverse por su nombre. */
  it('los tipos desconocidos se descartan al guardar', async () => {
    const { srv, repo } = servicio();

    await srv.guardar('org-1', 'c-casa', { email: 'ana@local.cl', tipos: ['reservas', 'inventado'] }, 'u-1');

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ tipos: ['reservas'], createdBy: 'u-1' }));
  });

  /* El error que se comete es volver a agregar a alguien para cambiarle los avisos. */
  it('anotar dos veces la misma dirección corrige la que ya estaba', async () => {
    const existente = fila({ id: 'd-1', email: 'ana@local.cl', tipos: ['reservas'], cargo: 'garzona' });
    const { srv, repo } = servicio();
    repo.findOne.mockResolvedValue(existente as never);

    await srv.guardar('org-1', 'c-casa', { email: 'ANA@local.cl ', tipos: ['grupos'] });

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'd-1', tipos: ['grupos'], cargo: 'garzona' }));
  });
});
