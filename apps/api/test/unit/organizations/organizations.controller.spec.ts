import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationsController } from '../../../src/modules/organizations/organizations.controller';
import { ROLES_KEY } from '../../../src/core/authorization/roles.decorator';
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

  it('reserva el cambio de módulos al rol dev, no al admin', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.updateFeatures)).toEqual([UserRole.DEV]);
  });

  it('rechaza apagar dashboard: es la ruta de entrada de los cargos internos', async () => {
    await expect(controller.updateFeatures(request, { features: { dashboard: false } })).rejects.toBeInstanceOf(BadRequestException);
    expect(organizations.update).not.toHaveBeenCalled();
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
