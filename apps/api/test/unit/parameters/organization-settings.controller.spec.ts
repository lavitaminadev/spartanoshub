import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationSettingsController } from '../../../src/core/parameters/organization-settings.controller';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

describe('OrganizationSettingsController: límites de configuración por rol', () => {
  const settings = { list: vi.fn(), update: vi.fn() };
  let controller: OrganizationSettingsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new OrganizationSettingsController(settings as any);
  });

  it('impide que admin cambie el ciclo de vida de módulos', () => {
    const request = { organizationId: 'org-1', user: { id: 'admin-1', role: UserRole.ADMIN } } as any;

    expect(() => controller.update(request, { values: { 'modules.lifecycle.production': 'active' } })).toThrow(ForbiddenException);
    expect(settings.update).not.toHaveBeenCalled();
  });

  it('permite al admin cambiar configuración general que no libera módulos', () => {
    const request = { organizationId: 'org-1', user: { id: 'admin-1', role: UserRole.ADMIN } } as any;
    settings.update.mockReturnValue([{ key: 'security.password.expiryDays', value: '90' }]);

    controller.update(request, { values: { 'security.password.expiryDays': '90' } });

    expect(settings.update).toHaveBeenCalledWith('org-1', 'admin-1', { 'security.password.expiryDays': '90' });
  });

  it('permite que dev cambie el ciclo de vida de módulos', () => {
    const request = { organizationId: 'org-1', user: { id: 'dev-1', role: UserRole.DEV } } as any;
    settings.update.mockReturnValue([{ key: 'modules.lifecycle.production', value: 'active' }]);

    controller.update(request, { values: { 'modules.lifecycle.production': 'active' } });

    expect(settings.update).toHaveBeenCalledWith('org-1', 'dev-1', { 'modules.lifecycle.production': 'active' });
  });
});
