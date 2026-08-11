import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { RecentAuthGuard } from '../../../src/core/auth/recent-auth.guard';

const reflector = { getAllAndOverride: vi.fn() };
const sessions = { hasRecentAuth: vi.fn() };

function contextFor(user: Record<string, unknown> | undefined) {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
}

describe('RecentAuthGuard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no consulta nada en un endpoint sin marca', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const guard = new RecentAuthGuard(reflector as never, sessions as never);

    expect(await guard.canActivate(contextFor({ sessionId: 'session-1' }))).toBe(true);
    expect(sessions.hasRecentAuth).not.toHaveBeenCalled();
  });

  it('AUTH-19 · deja pasar cuando la contraseña se confirmó hace poco', async () => {
    reflector.getAllAndOverride.mockReturnValue('cambiar el cargo de una persona');
    sessions.hasRecentAuth.mockResolvedValue(true);
    const guard = new RecentAuthGuard(reflector as never, sessions as never);

    expect(await guard.canActivate(contextFor({ sessionId: 'session-1' }))).toBe(true);
  });

  it('AUTH-19 · pide la contraseña cuando la confirmación caducó', async () => {
    reflector.getAllAndOverride.mockReturnValue('cambiar el cargo de una persona');
    sessions.hasRecentAuth.mockResolvedValue(false);
    const guard = new RecentAuthGuard(reflector as never, sessions as never);

    await expect(guard.canActivate(contextFor({ sessionId: 'session-1' })))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el error dice que hace falta reautenticarse, para que el cliente sepa qué pedir', async () => {
    reflector.getAllAndOverride.mockReturnValue('desconectar la integración con Meta');
    sessions.hasRecentAuth.mockResolvedValue(false);
    const guard = new RecentAuthGuard(reflector as never, sessions as never);

    const error = await guard.canActivate(contextFor({ sessionId: 'session-1' })).catch((e) => e);

    expect(error.getResponse()).toMatchObject({ reauthRequired: true });
    expect(error.getResponse().message).toContain('desconectar la integración con Meta');
  });

  it('un token sin sesión no puede confirmar, así que se rechaza', async () => {
    // Decisión segura: cuando la comprobación no se puede hacer, no se deja pasar.
    reflector.getAllAndOverride.mockReturnValue('restablecer la contraseña de otra persona');
    const guard = new RecentAuthGuard(reflector as never, sessions as never);

    await expect(guard.canActivate(contextFor({ id: 'user-1' })))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(sessions.hasRecentAuth).not.toHaveBeenCalled();
  });
});
