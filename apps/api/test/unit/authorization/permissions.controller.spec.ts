import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionsController } from '../../../src/core/authorization/permissions.controller';
import { ROLES_KEY } from '../../../src/core/authorization/roles.decorator';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

describe('PermissionsController: separación admin/dev', () => {
  const permissions = {
    roleMatrix: vi.fn(),
    codeLevel: vi.fn(),
    invalidateUser: vi.fn(),
    invalidateOrganization: vi.fn(),
  };
  const overrides = { find: vi.fn(), findOne: vi.fn(), save: vi.fn(), remove: vi.fn() };
  const roleOverrides = { find: vi.fn(), remove: vi.fn(), save: vi.fn() };
  const users = { find: vi.fn(), findOne: vi.fn() };
  const clientAccess = { findOne: vi.fn(), save: vi.fn(), remove: vi.fn() };
  const clients = { findOne: vi.fn() };
  const accountAccess = { explain: vi.fn(), invalidateUser: vi.fn(), allowedClientIds: vi.fn() };
  const audit = { log: vi.fn() };

  let controller: PermissionsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new PermissionsController(
      permissions as any,
      overrides as any,
      roleOverrides as any,
      users as any,
      clientAccess as any,
      clients as any,
      accountAccess as any,
      audit as any,
    );
  });

  it('reserva la matriz base de permisos al rol dev', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PermissionsController.prototype.roleMatrix)).toEqual([UserRole.DEV]);
    expect(Reflect.getMetadata(ROLES_KEY, PermissionsController.prototype.updateRoleMatrix)).toEqual([UserRole.DEV]);
    expect(Reflect.getMetadata(ROLES_KEY, PermissionsController.prototype.ofRole)).toEqual([UserRole.DEV]);
  });

  it('impide que admin administre excepciones de una cuenta dev', async () => {
    users.findOne.mockResolvedValue({ id: 'dev-1', organizationId: 'org-1', role: UserRole.DEV });

    await expect(controller.upsert(
      'dev-1',
      'dashboard',
      { level: 'view', reason: 'test' },
      { organizationId: 'org-1', user: { id: 'admin-1', role: UserRole.ADMIN } } as any,
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(overrides.save).not.toHaveBeenCalled();
  });

  it('persiste el vencimiento de una excepción temporal', async () => {
    users.findOne.mockResolvedValue({ id: 'designer-1', organizationId: 'org-1', role: UserRole.DESIGNER });
    overrides.findOne.mockResolvedValue(undefined);
    overrides.save.mockImplementation(async (value) => ({ id: 'override-1', ...value }));

    await controller.upsert(
      'designer-1',
      'reservations',
      { level: 'edit', reason: 'Cobertura', expiresAt: '2026-09-01T12:30:00.000Z' },
      { organizationId: 'org-1', user: { id: 'admin-1', role: UserRole.ADMIN } } as any,
    );

    expect(overrides.save).toHaveBeenCalledWith(expect.objectContaining({
      expiresAt: new Date('2026-09-01T12:30:00.000Z'),
    }));
  });
});
