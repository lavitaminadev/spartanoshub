import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationSettingsController } from '../../../src/core/parameters/organization-settings.controller';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

describe('OrganizationSettingsController: límites de configuración por rol', () => {
  const settings = { list: vi.fn(), update: vi.fn() };
  // Sin empresa elegida no hay nada que comprobar; con ella, esto es la reja de alcance.
  const accountAccess = { assertClient: vi.fn().mockResolvedValue(undefined) };
  let controller: OrganizationSettingsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new OrganizationSettingsController(settings as any, accountAccess as any);
  });

  it('impide que admin cambie el ciclo de vida de módulos', async () => {
    const request = { organizationId: 'org-1', user: { id: 'admin-1', role: UserRole.ADMIN } } as any;

    await expect(controller.update(request, { values: { 'modules.lifecycle.production': 'active' } })).rejects.toThrow(ForbiddenException);
    expect(settings.update).not.toHaveBeenCalled();
  });

  it('permite al admin cambiar configuración general que no libera módulos', async () => {
    const request = { organizationId: 'org-1', user: { id: 'admin-1', role: UserRole.ADMIN } } as any;
    settings.update.mockReturnValue([{ key: 'security.password.expiryDays', value: '90' }]);

    await controller.update(request, { values: { 'security.password.expiryDays': '90' } });

    // El cuarto argumento es la empresa: `null` significa que se edita el valor general, que es lo
    // que corresponde cuando no se elige ninguna.
    expect(settings.update).toHaveBeenCalledWith('org-1', 'admin-1', { 'security.password.expiryDays': '90' }, null);
  });

  it('permite que dev cambie el ciclo de vida de módulos', async () => {
    const request = { organizationId: 'org-1', user: { id: 'dev-1', role: UserRole.DEV } } as any;
    settings.update.mockReturnValue([{ key: 'modules.lifecycle.production', value: 'active' }]);

    await controller.update(request, { values: { 'modules.lifecycle.production': 'active' } });

    expect(settings.update).toHaveBeenCalledWith('org-1', 'dev-1', { 'modules.lifecycle.production': 'active' }, null);
  });
});
