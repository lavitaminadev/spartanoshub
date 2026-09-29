import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PortalHomeController } from '../../../src/modules/client-portal/portal-home.controller';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

/*
 * Las empresas de una cuenta de portal salen de aquí y no de `/clients`.
 *
 * `/clients` pertenece al módulo Clientes, que es de la agencia: una cuenta de portal lo pedía y
 * recibía un 403. La pantalla leía esa lista vacía como «tiene una sola empresa» y caía a la de su
 * sesión, así que quien atendía dos locales nunca veía el segundo ni el selector para cambiar.
 */
function controlador(permitidas: string[], filas: Array<{ id: string; name: string; capabilities?: unknown }>) {
  const accesos = { allowedClientIds: vi.fn().mockResolvedValue(permitidas) };
  const clientes = { find: vi.fn().mockResolvedValue(filas) };
  const ctrl = new PortalHomeController(
    {} as never, {} as never, {} as never, accesos as never, clientes as never,
  );
  return { ctrl, accesos, clientes };
}

const peticion = (role: UserRole, clientId?: string) => ({
  organizationId: 'org-1',
  user: { id: 'u-1', role, clientId, organizationId: 'org-1' },
}) as never;

describe('empresas de una cuenta de portal', () => {
  it('devuelve todas las que alcanza, con la propia primero', async () => {
    const { ctrl } = controlador(['c-propia', 'c-asignada'], [
      { id: 'c-asignada', name: 'FastNotJunk', capabilities: { crm: true } },
      { id: 'c-propia', name: 'GRDS', capabilities: { crm: true } },
    ]);
    const { data } = await ctrl.empresas(peticion(UserRole.CLIENT, 'c-propia'));
    expect(data.map((empresa) => empresa.name)).toEqual(['GRDS', 'FastNotJunk']);
  });

  it('con una sola empresa devuelve una: la pantalla no ofrece elegir', async () => {
    const { ctrl } = controlador(['c-propia'], [{ id: 'c-propia', name: 'GRDS' }]);
    const { data } = await ctrl.empresas(peticion(UserRole.CLIENT, 'c-propia'));
    expect(data).toHaveLength(1);
  });

  it('no devuelve una empresa que el alcance no concede, aunque exista', async () => {
    const { ctrl, clientes } = controlador(['c-propia'], [{ id: 'c-propia', name: 'GRDS' }]);
    await ctrl.empresas(peticion(UserRole.CLIENT, 'c-propia'));
    // La consulta se acota a lo permitido: el filtro no queda del lado de la pantalla.
    expect(clientes.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-1' }) }));
  });

  it('sin ninguna alcanzable no consulta nada', async () => {
    const { ctrl, clientes } = controlador([], []);
    await expect(ctrl.empresas(peticion(UserRole.CLIENT, undefined))).resolves.toEqual({ data: [] });
    expect(clientes.find).not.toHaveBeenCalled();
  });

  it('no es para el equipo de la agencia: ellos tienen su propio listado', async () => {
    const { ctrl } = controlador(['c'], [{ id: 'c', name: 'GRDS' }]);
    await expect(ctrl.empresas(peticion(UserRole.COMMERCIAL_DIRECTOR))).rejects.toThrow(ForbiddenException);
  });
});
