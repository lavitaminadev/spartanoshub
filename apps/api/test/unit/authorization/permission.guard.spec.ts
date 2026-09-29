import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PermissionGuard } from '../../../src/core/authorization/permission.guard';
import { IS_PUBLIC_KEY } from '../../../src/core/auth/decorators/public.decorator';
import { MODULE_EXEMPT_KEY, MODULE_SCOPE_KEY } from '../../../src/core/authorization/module-scope.decorator';
import { REQUIRES_PERMISSION_KEY } from '../../../src/core/authorization/requires-permission.decorator';
import { REQUIRES_FEATURE_KEY } from '../../../src/core/authorization/requires-feature.decorator';

const AUTHENTICATED = { id: 'user-1', role: 'designer', organizationId: 'org-1' };

/** Reflector que responde solo a las claves indicadas y `undefined` al resto. */
function reflectorWith(metadata: Record<string, unknown>) {
  return { getAllAndOverride: vi.fn((key: string) => metadata[key]) } as any;
}

function executionContext(method = 'GET', request: Record<string, unknown> = { user: AUTHENTICATED, organizationId: 'org-1' }) {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => ({ method, url: '/api/prueba', ...request }) }),
  } as any;
}

function resolverThatAnswers(allowed: boolean) {
  return { can: vi.fn().mockResolvedValue(allowed) } as any;
}

describe('PermissionGuard', () => {
  it('niega un endpoint que no declara módulo', async () => {
    // Es la diferencia central: antes lo no anotado pasaba libre, de modo que quitarle un
    // modulo a alguien ocultaba su menu pero la API le seguia respondiendo.
    const guard = new PermissionGuard(reflectorWith({}), resolverThatAnswers(true));

    await expect(guard.canActivate(executionContext())).rejects.toThrow(ForbiddenException);
  });

  it('deja pasar las rutas públicas sin consultar permisos', async () => {
    const resolver = resolverThatAnswers(false);
    const guard = new PermissionGuard(reflectorWith({ [IS_PUBLIC_KEY]: true }), resolver);

    await expect(guard.canActivate(executionContext())).resolves.toBe(true);
    expect(resolver.can).not.toHaveBeenCalled();
  });

  it('deja pasar lo declarado exento', async () => {
    const resolver = resolverThatAnswers(false);
    const guard = new PermissionGuard(
      reflectorWith({ [MODULE_EXEMPT_KEY]: 'Autoservicio de la propia cuenta' }),
      resolver,
    );

    await expect(guard.canActivate(executionContext())).resolves.toBe(true);
    expect(resolver.can).not.toHaveBeenCalled();
  });

  it('deduce el nivel del verbo: consultar exige view', async () => {
    const resolver = resolverThatAnswers(true);
    const guard = new PermissionGuard(reflectorWith({ [MODULE_SCOPE_KEY]: 'crm' }), resolver);

    await guard.canActivate(executionContext('GET'));

    expect(resolver.can).toHaveBeenCalledWith('org-1', 'user-1', 'designer', 'crm', 'view', undefined);
  });

  it('deduce el nivel del verbo: modificar exige edit', async () => {
    const resolver = resolverThatAnswers(true);
    const guard = new PermissionGuard(reflectorWith({ [MODULE_SCOPE_KEY]: 'crm' }), resolver);

    await guard.canActivate(executionContext('PATCH'));

    expect(resolver.can).toHaveBeenCalledWith('org-1', 'user-1', 'designer', 'crm', 'edit', undefined);
  });

  it('deduce el nivel del verbo: borrar exige manage', async () => {
    const resolver = resolverThatAnswers(true);
    const guard = new PermissionGuard(reflectorWith({ [MODULE_SCOPE_KEY]: 'crm' }), resolver);

    await guard.canActivate(executionContext('DELETE'));

    expect(resolver.can).toHaveBeenCalledWith('org-1', 'user-1', 'designer', 'crm', 'manage', undefined);
  });

  it('rechaza un módulo futuro antes de consultar permisos', async () => {
    const resolver = resolverThatAnswers(true);
    const guard = new PermissionGuard(reflectorWith({ [REQUIRES_FEATURE_KEY]: 'billing' }), resolver);

    await expect(guard.canActivate(executionContext('GET'))).rejects.toThrow(ForbiddenException);
    expect(resolver.can).not.toHaveBeenCalled();
  });

  it('da precedencia al nivel explícito de @RequiresPermission sobre el verbo', async () => {
    const resolver = resolverThatAnswers(true);
    const guard = new PermissionGuard(
      reflectorWith({
        [REQUIRES_PERMISSION_KEY]: { module: 'crm', level: 'manage' },
        [MODULE_SCOPE_KEY]: 'reservations',
      }),
      resolver,
    );

    await guard.canActivate(executionContext('GET'));

    expect(resolver.can).toHaveBeenCalledWith('org-1', 'user-1', 'designer', 'crm', 'manage', undefined);
  });

  it('rechaza cuando el nivel resuelto no alcanza', async () => {
    const guard = new PermissionGuard(reflectorWith({ [MODULE_SCOPE_KEY]: 'crm' }), resolverThatAnswers(false));

    await expect(guard.canActivate(executionContext('GET'))).rejects.toThrow(ForbiddenException);
  });

  it('rechaza cuando la petición no trae usuario resuelto', async () => {
    const guard = new PermissionGuard(reflectorWith({ [MODULE_SCOPE_KEY]: 'clients' }), resolverThatAnswers(true));

    await expect(guard.canActivate(executionContext('GET', {}))).rejects.toThrow(ForbiddenException);
  });

  /*
   * La empresa entra en la pregunta.
   *
   * Hay permisos que se entregan empresa por empresa —administrar el equipo— y viven como
   * excepción con `client_id`. Resolviendo sin decir cuál se descartan todas, así que la puerta
   * negaba lo que la base concedía y el servicio que sí mira la empresa nunca se ejecutaba.
   */
  describe('la empresa sobre la que va la petición', () => {
    it('la toma de la cuenta cuando es una cuenta de empresa', async () => {
      const resolver = resolverThatAnswers(true);
      const guard = new PermissionGuard(reflectorWith({ [MODULE_SCOPE_KEY]: 'users' }), resolver);
      const portal = { id: 'user-9', role: 'client', organizationId: 'org-1', clientId: 'empresa-1' };

      await guard.canActivate(executionContext('GET', { user: portal, organizationId: 'org-1' }));

      expect(resolver.can).toHaveBeenCalledWith('org-1', 'user-9', 'client', 'users', 'view', 'empresa-1');
    });

    it('la toma de la consulta cuando se está mirando otra', async () => {
      const resolver = resolverThatAnswers(true);
      const guard = new PermissionGuard(reflectorWith({ [MODULE_SCOPE_KEY]: 'users' }), resolver);
      const portal = { id: 'user-9', role: 'client', organizationId: 'org-1', clientId: 'empresa-1' };

      await guard.canActivate(executionContext('GET', { user: portal, organizationId: 'org-1', query: { clientId: 'empresa-2' } }));

      expect(resolver.can).toHaveBeenCalledWith('org-1', 'user-9', 'client', 'users', 'view', 'empresa-2');
    });

    it('la toma del cuerpo cuando la petición la trae ahí', async () => {
      const resolver = resolverThatAnswers(true);
      const guard = new PermissionGuard(reflectorWith({ [MODULE_SCOPE_KEY]: 'crm' }), resolver);

      await guard.canActivate(executionContext('POST', { user: AUTHENTICATED, organizationId: 'org-1', body: { clientId: 'empresa-3' } }));

      expect(resolver.can).toHaveBeenCalledWith('org-1', 'user-1', 'designer', 'crm', 'edit', 'empresa-3');
    });

    it('nombrar una empresa no concede nada: si el resolutor dice que no, se rechaza igual', async () => {
      // La empresa sólo hace que se miren las excepciones escritas para ella. Una ajena escrita
      // a mano en la dirección no encuentra ninguna.
      const guard = new PermissionGuard(reflectorWith({ [MODULE_SCOPE_KEY]: 'users' }), resolverThatAnswers(false));
      const portal = { id: 'user-9', role: 'client', organizationId: 'org-1', clientId: 'empresa-1' };

      await expect(
        guard.canActivate(executionContext('GET', { user: portal, organizationId: 'org-1', query: { clientId: 'empresa-ajena' } })),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
