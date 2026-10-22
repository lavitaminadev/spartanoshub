/**
 * Sobre qué empresa administra el equipo una cuenta de portal.
 *
 * Es la pantalla con la que se crean cuentas y se reparten accesos, así que equivocarse de
 * empresa aquí no muestra datos de más: los concede. La resolución decía «la pedida si la
 * alcanza, si no la mía», y ese «si no la mía» convertía «administrar el local que escribí» en
 * «administrar mi local» con un 200 encima, de modo que nada en la respuesta delataba que la
 * dirección no se había tenido en cuenta.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdministracionDelEquipoService } from '../../../src/modules/users/administracion-del-equipo.service';

const PORTAL = (clientId?: string) => ({
  organizationId: 'org-1',
  user: { id: 'u1', role: 'client', clientId, organizationId: 'org-1' },
}) as never;

const INTERNA = { organizationId: 'org-1', user: { id: 'u2', role: 'admin', organizationId: 'org-1' } } as never;

function montar(alcanzables: string[] | undefined, administra = true) {
  const permisos = { can: vi.fn().mockResolvedValue(administra) };
  const alcanceDeCuentas = {
    allowedClientIds: vi.fn().mockResolvedValue(alcanzables),
    assertClient: vi.fn(async (_org: string, _user: unknown, clientId: string) => {
      if (alcanzables !== undefined && !alcanzables.includes(clientId)) throw new NotFoundException('Client not found');
    }),
  };
  return { servicio: new AdministracionDelEquipoService(permisos as never, alcanceDeCuentas as never), permisos };
}

describe('alcance de administración del equipo', () => {
  it('el equipo interno no se acota a ninguna empresa', async () => {
    const { servicio } = montar(['centro']);
    expect(await servicio.alcance(INTERNA)).toEqual({});
  });

  it('una cuenta de portal administra el local que declara, si lo alcanza', async () => {
    const { servicio, permisos } = montar(['centro', 'providencia']);

    expect(await servicio.alcance(PORTAL('centro'), 'providencia')).toEqual({ soloEmpresa: 'providencia' });
    // El permiso se comprueba sobre ese local: administrar uno no implica administrar el otro.
    expect(permisos.can).toHaveBeenCalledWith('org-1', 'u1', 'client', 'users', 'manage', 'providencia');
  });

  /* El caso que justifica el cambio: antes devolvía `{ soloEmpresa: 'centro' }` y un 200. */
  it('un local que no alcanza da 404, y no se cambia por el suyo', async () => {
    const { servicio } = montar(['centro']);

    await expect(servicio.alcance(PORTAL('centro'), 'ajena')).rejects.toThrow(NotFoundException);
  });

  it('sin declarar nada administra el suyo', async () => {
    const { servicio } = montar(['centro']);
    expect(await servicio.alcance(PORTAL('centro'))).toEqual({ soloEmpresa: 'centro' });
  });

  /*
   * Una cuenta externa sin empresa no se trata como «sin acotar»: eso le daría el equipo entero
   * de la organización, que es lo contrario de lo que la ausencia significa.
   */
  it('una cuenta de portal sin empresa no administra a nadie', async () => {
    const { servicio } = montar([]);
    await expect(servicio.alcance(PORTAL(undefined))).rejects.toThrow(ForbiddenException);
  });

  it('alcanzar el local no basta: hace falta administrarlo', async () => {
    const { servicio } = montar(['centro', 'providencia'], false);
    await expect(servicio.alcance(PORTAL('centro'), 'providencia')).rejects.toThrow(ForbiddenException);
  });

  it('los espacios alrededor no cuentan como local declarado', async () => {
    const { servicio } = montar(['centro']);
    expect(await servicio.alcance(PORTAL('centro'), '   ')).toEqual({ soloEmpresa: 'centro' });
  });
});
