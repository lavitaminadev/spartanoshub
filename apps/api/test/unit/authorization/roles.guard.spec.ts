import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { RolesGuard } from '../../../src/core/authorization/roles.guard';
import { ROLES_KEY } from '../../../src/core/authorization/roles.decorator';
import { IS_PUBLIC_KEY } from '../../../src/core/auth/decorators/public.decorator';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

function contextFor(role: UserRole): ExecutionContext {
  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: vi.fn(),
  } as unknown as { getAllAndOverride: ReturnType<typeof vi.fn> } & Reflector;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows public routes without checking roles', () => {
    reflector.getAllAndOverride.mockImplementation((key) => key === IS_PUBLIC_KEY ? true : undefined);

    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextFor(UserRole.DESIGNER))).toBe(true);
  });

  it('allows dev through role lists so module permissions remain the source of truth', () => {
    reflector.getAllAndOverride.mockImplementation((key) => key === ROLES_KEY ? [UserRole.ADMIN] : undefined);

    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextFor(UserRole.DEV))).toBe(true);
  });

  it('keeps denying non-dev roles that are not listed', () => {
    reflector.getAllAndOverride.mockImplementation((key) => key === ROLES_KEY ? [UserRole.ADMIN] : undefined);

    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextFor(UserRole.DESIGNER))).toBe(false);
  });
});
