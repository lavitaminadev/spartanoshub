import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PermissionGuard } from '../../../src/core/authorization/permission.guard';
import { MODULE_SCOPE_KEY } from '../../../src/core/authorization/module-scope.decorator';
import { LeadCreatedEmailListener } from '../../../src/modules/crm/leads/lead-created-email.listener';
import { avisosVisibles, servicioDelAviso } from '../../../src/core/notifications/notificaciones-visibles';

/*
 * Un servicio apagado no se abre, no avisa y no se nombra: ni por la API, ni por correo, ni en
 * la campana. Los datos no se tocan; al reactivarlo todo vuelve.
 */
const reflector = (modulo: string) => ({ getAllAndOverride: vi.fn((clave: string) => (clave === MODULE_SCOPE_KEY ? modulo : undefined)) }) as never;
const permisos = { can: vi.fn().mockResolvedValue(true) } as never;
const contexto = (request: Record<string, unknown>) => ({
  getHandler: vi.fn(), getClass: vi.fn(),
  switchToHttp: () => ({ getRequest: () => ({ method: 'GET', url: '/api/x', organizationId: 'org', user: { id: 'u', role: 'admin', organizationId: 'org' }, ...request }) }),
}) as never;

describe('la API no abre un módulo que la empresa no tiene', () => {
  it('con CRM apagado, pedir esa empresa en el CRM se rechaza', async () => {
    const capacidades = { assert: vi.fn().mockRejectedValue(new ForbiddenException('Esta empresa no tiene CRM')) };
    const guard = new PermissionGuard(reflector('crm'), permisos, capacidades as never);
    await expect(guard.canActivate(contexto({ query: { clientId: 'sin-crm' } }))).rejects.toThrow(ForbiddenException);
    expect(capacidades.assert).toHaveBeenCalledWith('org', 'sin-crm', 'crm');
  });

  it('el embudo de la agencia, sin empresa, no se comprueba', async () => {
    const capacidades = { assert: vi.fn() };
    const guard = new PermissionGuard(reflector('crm'), permisos, capacidades as never);
    await expect(guard.canActivate(contexto({ query: {} }))).resolves.toBe(true);
    expect(capacidades.assert).not.toHaveBeenCalled();
  });

  it('un módulo que no es un servicio contratado no se comprueba', async () => {
    const capacidades = { assert: vi.fn() };
    const guard = new PermissionGuard(reflector('users'), permisos, capacidades as never);
    await guard.canActivate(contexto({ query: { clientId: 'c' } }));
    expect(capacidades.assert).not.toHaveBeenCalled();
  });
});

describe('sin CRM no sale el aviso de lead nuevo', () => {
  it('guarda el lead pero no escribe', async () => {
    const email = { send: vi.fn() };
    const parametros = { get: vi.fn().mockResolvedValue(true) };
    const servicios = { enServicio: vi.fn().mockResolvedValue(false) };
    const listener = new LeadCreatedEmailListener({ findOne: vi.fn() } as never, { find: vi.fn() } as never, parametros as never, email as never, servicios as never);
    await listener.handle({ organizationId: 'org', leadId: 'l', clientId: 'sin-crm' });
    expect(servicios.enServicio).toHaveBeenCalledWith('org', 'sin-crm', 'crm');
    expect(email.send).not.toHaveBeenCalled();
  });
});

describe('la campana no nombra lo que ya no corresponde', () => {
  const aviso = (id: string, type: string, clientId?: string) => ({ id, type, data: clientId ? { clientId } : null }) as never;
  const user = { id: 'u', role: 'community_manager', organizationId: 'org' } as never;

  it('cada aviso sabe de qué servicio es', () => {
    expect(servicioDelAviso('reservation_created')).toBe('reservations');
    expect(servicioDelAviso('lead_ingested')).toBe('crm');
    expect(servicioDelAviso('system')).toBeNull();
  });

  it('oculta los de una empresa sin el servicio o fuera de su alcance, y deja los de la agencia', async () => {
    const accesos = { allowedClientIds: vi.fn().mockResolvedValue(['con-todo', 'sin-reservas']) };
    const servicios = { tiene: vi.fn(async (_o: string, clientId: string, servicio: string) => !(clientId === 'sin-reservas' && servicio === 'reservations')) };
    const visibles = await avisosVisibles([
      aviso('1', 'reservation_created', 'con-todo'),
      aviso('2', 'reservation_created', 'sin-reservas'),
      aviso('3', 'lead_ingested', 'sin-reservas'),
      aviso('4', 'lead_ingested', 'ajena'),
      aviso('5', 'task_reminder'),
    ], 'org', user, accesos as never, servicios as never);
    expect(visibles.map((v: { id: string }) => v.id)).toEqual(['1', '3', '5']);
  });
});
