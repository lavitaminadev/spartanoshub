import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthController } from '../../../src/core/auth/auth.controller';

const auth = {
  register: vi.fn(),
  validateUser: vi.fn(),
  login: vi.fn(),
  refreshToken: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  updateProfile: vi.fn(),
};

const response = {
  cookie: vi.fn(),
  clearCookie: vi.fn(),
} as unknown as Response;

describe('AuthController browser sessions', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController(auth as any);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('keeps the refresh token out of login JSON and sets a secure HttpOnly cookie', async () => {
    process.env.NODE_ENV = 'production';
    auth.validateUser.mockResolvedValue({
      id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'admin',
      organizationId: 'org-1', avatarUrl: null, clientId: null,
    });
    auth.login.mockResolvedValue({
      accessToken: 'access-token', refreshToken: 'refresh-token', user: {},
    });

    const result = await controller.login(
      { email: 'ana@example.com', password: 'secret123' },
      { headers: { 'user-agent': 'Chrome' } } as Request,
      '1.2.3.4',
      response,
    );

    expect(result).not.toHaveProperty('refreshToken');
    expect(response.cookie).toHaveBeenCalledWith('espartanos_refresh', 'refresh-token', expect.objectContaining({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/auth',
    }));
  });

  it('prefers the cookie and replaces it after token rotation', async () => {
    auth.refreshToken.mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    const request = { headers: { cookie: 'other=x; espartanos_refresh=cookie-token' } } as Request;

    const result = await controller.refresh({ refreshToken: 'body-token' }, request, response);

    expect(auth.refreshToken).toHaveBeenCalledWith('cookie-token');
    expect(result).toEqual({ accessToken: 'new-access' });
    expect(response.cookie).toHaveBeenCalledWith('espartanos_refresh', 'new-refresh', expect.any(Object));
  });

  it('accepts a session opened under the previous cookie name and migrates it', async () => {
    auth.refreshToken.mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    const request = { headers: { cookie: 'other=x; vitahub_refresh=legacy-token' } } as Request;

    const result = await controller.refresh({}, request, response);

    expect(auth.refreshToken).toHaveBeenCalledWith('legacy-token');
    expect(result).toEqual({ accessToken: 'new-access' });
    expect(response.cookie).toHaveBeenCalledWith('espartanos_refresh', 'new-refresh', expect.any(Object));
    expect(response.clearCookie).toHaveBeenCalledWith('vitahub_refresh', expect.any(Object));
  });

  it('reports an anonymous browser session without producing a 401', async () => {
    const result = await controller.browserSession(
      {},
      { headers: {} } as Request,
      response,
    );

    expect(result).toEqual({ authenticated: false });
    expect(auth.refreshToken).not.toHaveBeenCalled();
  });

  it('clears an expired browser session and reports it as anonymous', async () => {
    auth.refreshToken.mockRejectedValue(new UnauthorizedException());

    const result = await controller.browserSession(
      {},
      { headers: { cookie: 'espartanos_refresh=expired' } } as Request,
      response,
    );

    expect(result).toEqual({ authenticated: false });
    expect(response.clearCookie).toHaveBeenCalledWith('espartanos_refresh', expect.any(Object));
  });

  it('revokes the session and clears the browser cookie on logout', async () => {
    await controller.logout({ id: 'user-1', sessionId: 'session-1' } as any, response);

    // Cerrar sesion en el telefono no cierra la del computador: se pasa la sesion en curso.
    expect(auth.logout).toHaveBeenCalledWith('user-1', 'session-1');
    expect(response.clearCookie).toHaveBeenCalledWith('espartanos_refresh', expect.objectContaining({
      httpOnly: true,
      path: '/api/auth',
    }));
    // Tambien se retira la del nombre anterior: si no, una sesion abierta antes del cambio
    // seguiria presentando una cookie valida despues de cerrar sesion.
    expect(response.clearCookie).toHaveBeenCalledWith('vitahub_refresh', expect.any(Object));
  });
});
