import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PermissionGuard } from '../../../src/core/authorization/permission.guard';
import { MODULE_SCOPE_KEY } from '../../../src/core/authorization/module-scope.decorator';
import { ClientCapabilityService } from '../../../src/core/client-scope/client-capability.service';
import { CreateClientUseCase } from '../../../src/modules/clients/create-client.use-case';
import {
  CAPACIDADES_DE_MODULO,
  DEFAULT_CLIENT_CAPABILITIES,
  normalizeClientCapabilities,
} from '../../../src/modules/clients/client-capabilities';

/*
 * Los doce módulos cuyo sujeto es una empresa se contratan por empresa: nacen apagados y la
 * puerta HTTP no deja entrar a una empresa que no los tiene.
 */
const reflector = (modulo: string) => ({ getAllAndOverride: vi.fn((clave: string) => (clave === MODULE_SCOPE_KEY ? modulo : undefined)) }) as never;
const permisos = { can: vi.fn().mockResolvedValue(true) } as never;
// Con rol `dev` la puerta de despliegue no interviene, y lo que decide es la capacidad de la empresa.
const contexto = (clientId: string, role = 'dev') => ({
  getHandler: vi.fn(), getClass: vi.fn(),
  switchToHttp: () => ({
    getRequest: () => ({ method: 'GET', url: '/api/x', organizationId: 'org', query: { clientId }, user: { id: 'u', role, organizationId: 'org' } }),
  }),
}) as never;

/** La misma petición, sin nombrar ninguna empresa. */
const sinEmpresa = (role = 'dev') => ({
  getHandler: vi.fn(), getClass: vi.fn(),
  switchToHttp: () => ({
    getRequest: () => ({ method: 'GET', url: '/api/x', organizationId: 'org', query: {}, user: { id: 'u', role, organizationId: 'org' } }),
  }),
}) as never;

/** Servicio de capacidades real sobre un repositorio que guarda lo que se le diga de cada empresa. */
const capacidadesDe = (porEmpresa: Record<string, Record<string, boolean>>) => new ClientCapabilityService({
  findOne: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, capabilities: porEmpresa[where.id] })),
} as never);

describe('los módulos por empresa', () => {
  it('son los doce acordados', () => {
    expect([...CAPACIDADES_DE_MODULO].sort()).toEqual([
      'approvals', 'audiovisual', 'billing', 'briefs', 'commercialPipeline', 'content',
      'contracts', 'documents', 'intake', 'meetings', 'production', 'reports',
    ]);
  });

  it('nacen apagados, y una empresa guardada sin la clave también cuenta como apagada', () => {
    for (const clave of CAPACIDADES_DE_MODULO) {
      expect(DEFAULT_CLIENT_CAPABILITIES[clave], clave).toBe(false);
      expect(normalizeClientCapabilities({ crm: true })[clave], clave).toBe(false);
    }
  });

  it('al crear una empresa quedan apagados aunque se encienda otro servicio', async () => {
    const guardados: Array<{ capabilities: Record<string, boolean> }> = [];
    const repo = { create: (x: never) => x, save: async (x: { capabilities: Record<string, boolean> }) => { guardados.push(x); return x; } };
    const caso = new CreateClientUseCase(repo as never, {} as never, {} as never);
    await caso.execute({ organizationId: 'org', name: 'Empresa', capabilities: { crm: true } });
    for (const clave of CAPACIDADES_DE_MODULO) expect(guardados[0].capabilities[clave], clave).toBe(false);
  });

  it.each([...CAPACIDADES_DE_MODULO])('%s: una empresa sin la capacidad recibe 403 y una con ella entra', async (modulo) => {
    const capacidades = capacidadesDe({ sin: {}, con: { [modulo]: true } });
    const guard = new PermissionGuard(reflector(modulo), permisos, capacidades);

    await expect(guard.canActivate(contexto('sin'))).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(contexto('con'))).resolves.toBe(true);
  });

  /*
   * La reja se comprobaba sólo si la petición nombraba una empresa, así que quitar `?clientId=`
   * de la dirección dejaba la petición sin capacidad **y** sin empresa: entraba. Para un módulo
   * cuyo sujeto es siempre una empresa atendida, no decir cuál no es una consulta agregada.
   */
  it.each([...CAPACIDADES_DE_MODULO])('%s: omitir la empresa no salta la comprobación', async (modulo) => {
    const guard = new PermissionGuard(reflector(modulo), permisos, capacidadesDe({ con: { [modulo]: true } }));

    await expect(guard.canActivate(sinEmpresa())).rejects.toThrow(BadRequestException);
  });

  /*
   * Y el otro lado: CRM, Reservas y Encuestas tienen rutas que de verdad son de la agencia —el
   * panel de dirección, los listados—, así que exigirles empresa las rompería.
   */
  it.each(['crm', 'reservations', 'surveys'])('%s sigue admitiendo una petición sin empresa', async (modulo) => {
    const guard = new PermissionGuard(reflector(modulo), permisos, capacidadesDe({}));

    await expect(guard.canActivate(sinEmpresa())).resolves.toBe(true);
  });

  it('encender uno no abre los otros', async () => {
    const capacidades = capacidadesDe({ e: { billing: true } });
    await expect(new PermissionGuard(reflector('billing'), permisos, capacidades).canActivate(contexto('e'))).resolves.toBe(true);
    await expect(new PermissionGuard(reflector('contracts'), permisos, capacidades).canActivate(contexto('e'))).rejects.toThrow(ForbiddenException);
  });
});

describe('mientras la puerta de despliegue siga puesta', () => {
  it('sigue cerrada a quien no es desarrollo, tenga o no la empresa la capacidad', async () => {
    const capacidades = capacidadesDe({ con: { production: true } });
    const guard = new PermissionGuard(reflector('production'), permisos, capacidades);
    await expect(guard.canActivate(contexto('con', 'admin'))).rejects.toThrow('aún no está disponible');
  });
});
