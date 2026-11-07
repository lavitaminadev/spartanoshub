import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationsController } from '../../../src/modules/organizations/organizations.controller';
import { ROLES_KEY } from '../../../src/core/authorization/roles.decorator';
import { REQUIRES_RECENT_AUTH_KEY } from '../../../src/core/auth/requires-recent-auth.decorator';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

describe('OrganizationsController: módulos esenciales', () => {
  const createOrg = { execute: vi.fn(), executeUpdate: vi.fn() };
  const listOrgs = { execute: vi.fn() };
  const organizations = { findOne: vi.fn(), save: vi.fn() };
  const featureGuard = { invalidate: vi.fn() };
  const permissionResolver = { invalidateOrganization: vi.fn() };
  const audit = { log: vi.fn() };
  const request = { organizationId: 'org-1', user: { id: 'admin-1', organizationId: 'org-1' } } as any;

  let controller: OrganizationsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new OrganizationsController(
      createOrg as any, listOrgs as any, organizations as any, featureGuard as any,
      permissionResolver as any, audit as any,
    );
  });

  /**
   * Desarrollo y administración, y con la contraseña otra vez.
   *
   * Era sólo `dev`, con el argumento de que encender un módulo va después de comprobar que
   * funciona en el servidor. Sigue siendo cierto, pero el efecto práctico era otro: la pantalla no
   * mostraba la sección a administración y el interruptor parecía averiado en vez de ajeno.
   *
   * La reautenticación reciente es lo que sostiene la apertura: encender un módulo abre pantallas
   * para toda la organización, igual que cambiar la matriz de cargos, y con una sesión robada es
   * lo que impide que el ataque llegue a la configuración. Si alguien suma un cargo acá sin ella,
   * esta prueba falla y hay que venir a explicarlo.
   */
  it('deja el cambio de módulos a desarrollo y administración, pidiendo la contraseña', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.updateFeatures)).toEqual([UserRole.DEV, UserRole.ADMIN]);
    expect(Reflect.getMetadata(REQUIRES_RECENT_AUTH_KEY, controller.updateFeatures)).toBeTruthy();
  });

  it('rechaza apagar dashboard: es la ruta de entrada de los cargos internos', async () => {
    await expect(controller.updateFeatures(request, { features: { dashboard: false } })).rejects.toBeInstanceOf(BadRequestException);
    expect(organizations.save).not.toHaveBeenCalled();
  });

  it('invalida las dos cachés al cambiar un módulo opcional', async () => {
    organizations.findOne
      .mockResolvedValueOnce({ id: 'org-1', features: { dashboard: true, reservations: true } })
      .mockResolvedValueOnce({ id: 'org-1', features: { dashboard: true, reservations: false } });
    organizations.save.mockResolvedValue(undefined);
    audit.log.mockResolvedValue(undefined);

    await controller.updateFeatures(request, { features: { reservations: false } });

    expect(featureGuard.invalidate).toHaveBeenCalledWith('org-1');
    expect(permissionResolver.invalidateOrganization).toHaveBeenCalledWith('org-1');
    expect(organizations.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'org-1',
      features: expect.objectContaining({ reservations: false }),
    }));
  });
});
