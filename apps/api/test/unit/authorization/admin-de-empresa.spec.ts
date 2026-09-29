import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionsController } from '../../../src/core/authorization/permissions.controller';
import { OrganizationSettingsController } from '../../../src/core/parameters/organization-settings.controller';
import { ROLES_KEY } from '../../../src/core/authorization/roles.decorator';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

/*
 * Quien administra el equipo de una empresa cliente.
 *
 * El permiso se entrega empresa por empresa. Estas pruebas fijan los dos lados: que funcione en
 * la empresa que se está mirando —aunque no sea la de su cuenta— y que nunca se salga de ella.
 */

/** Cuenta de portal cuya empresa propia es A y que además atiende B. */
const DUENIA = { id: 'duenia', role: UserRole.CLIENT, organizationId: 'org-1', clientId: 'empresa-a' };

describe('PermissionsController: quien administra una empresa', () => {
  const permissions = { can: vi.fn(), invalidateUser: vi.fn(), explain: vi.fn().mockResolvedValue([]), permissionsFor: vi.fn() };
  const overrides = { findOne: vi.fn(), save: vi.fn(), remove: vi.fn() };
  const users = { findOne: vi.fn() };
  const clientAccess = { findOne: vi.fn(), save: vi.fn(), remove: vi.fn() };
  const clients = { findOne: vi.fn() };
  const accountAccess = { explain: vi.fn(), invalidateUser: vi.fn(), allowedClientIds: vi.fn(), assertClient: vi.fn() };
  const audit = { log: vi.fn() };
  let controller: PermissionsController;

  /** Qué empresas alcanza cada persona. */
  let alcance: Record<string, string[]>;
  /** En qué empresas administra el equipo cada persona. */
  let administra: Record<string, string[]>;

  const req = { organizationId: 'org-1', user: DUENIA } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    alcance = { duenia: ['empresa-a', 'empresa-b'], vendedor: ['empresa-b'], ajeno: ['empresa-c'] };
    administra = { duenia: ['empresa-b'] };
    accountAccess.allowedClientIds.mockImplementation(async (_org: string, user: { id: string }) => alcance[user.id] ?? []);
    accountAccess.assertClient.mockResolvedValue(undefined);
    permissions.can.mockImplementation(async (_o: string, userId: string, _r: string, modulo: string, _n: string, empresa?: string) => (
      modulo === 'users' && Boolean(empresa) && (administra[userId] ?? []).includes(empresa as string)
    ));
    overrides.findOne.mockResolvedValue(undefined);
    overrides.save.mockImplementation(async (valor) => ({ id: 'o-1', ...valor }));
    users.findOne.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      vendedor: { id: 'vendedor', role: UserRole.CLIENT, organizationId: 'org-1', clientId: 'empresa-b' },
      ajeno: { id: 'ajeno', role: UserRole.CLIENT, organizationId: 'org-1', clientId: 'empresa-c' },
      interno: { id: 'interno', role: UserRole.DESIGNER, organizationId: 'org-1', clientId: null },
    } as Record<string, unknown>)[where.id]);
    controller = new PermissionsController(
      permissions as any, overrides as any, {} as any, users as any, clientAccess as any,
      clients as any, accountAccess as any, audit as any, {} as any, {} as any,
    );
  });

  it('reparte accesos en una empresa que administra aunque no sea la de su cuenta', async () => {
    await controller.upsert('vendedor', 'crm', { level: 'edit', clientId: 'empresa-b' }, req);

    expect(overrides.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'vendedor', module: 'crm', clientId: 'empresa-b' }));
  });

  it('nunca guarda una excepción general: sin empresa, queda en la del destinatario', async () => {
    // Guardada sin empresa valdría en todas las de esa persona, incluidas las que no administra.
    await controller.upsert('vendedor', 'crm', { level: 'edit' }, req);

    expect(overrides.findOne).toHaveBeenCalledWith({ where: { userId: 'vendedor', module: 'crm', clientId: 'empresa-b' } });
    expect(overrides.save).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'empresa-b' }));
  });

  it('al retirar, busca la excepción de su empresa y nunca la general', async () => {
    overrides.findOne.mockResolvedValue({ id: 'o-1', level: 'edit' });

    await controller.remove('vendedor', 'crm', req);

    expect(overrides.findOne).toHaveBeenCalledWith({ where: { userId: 'vendedor', module: 'crm', clientId: 'empresa-b' } });
    expect(overrides.findOne).not.toHaveBeenCalledWith({ where: { userId: 'vendedor', module: 'crm', clientId: IsNull() } });
  });

  it('puede retirar lo que puede conceder', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PermissionsController.prototype.remove)).toContain(UserRole.CLIENT);
    expect(Reflect.getMetadata(ROLES_KEY, PermissionsController.prototype.upsert)).toContain(UserRole.CLIENT);
  });

  it('no concede en una empresa que no administra', async () => {
    // La alcanza —es la de su cuenta— pero no administra su equipo.
    await expect(controller.upsert('vendedor', 'crm', { level: 'edit', clientId: 'empresa-a' }, req)).rejects.toBeInstanceOf(ForbiddenException);
    expect(overrides.save).not.toHaveBeenCalled();
  });

  it('no toca a quien no alcanza esa empresa', async () => {
    administra.duenia = ['empresa-b', 'empresa-c'];
    // Administraría C, pero ya no entra a C: una concesión olvidada no actúa.
    await expect(controller.upsert('ajeno', 'crm', { level: 'edit', clientId: 'empresa-c' }, req)).rejects.toBeInstanceOf(ForbiddenException);

    // Y a alguien de otra empresa no lo alcanza nombrando la suya.
    await expect(controller.upsert('ajeno', 'crm', { level: 'edit', clientId: 'empresa-b' }, req)).rejects.toBeInstanceOf(ForbiddenException);
    expect(overrides.save).not.toHaveBeenCalled();
  });

  it('no toca cuentas de la agencia', async () => {
    await expect(controller.upsert('interno', 'crm', { level: 'edit', clientId: 'empresa-b' }, req)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no entrega los módulos con los que se administra el sistema', async () => {
    await expect(controller.upsert('vendedor', 'users', { level: 'manage', clientId: 'empresa-b' }, req)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ve el alcance del destinatario sólo en su empresa, y que atiende otras sin saber cuáles', async () => {
    alcance.vendedor = ['empresa-b', 'empresa-secreta'];
    accountAccess.explain.mockResolvedValue([
      { clientId: 'empresa-b', source: 'own' },
      { clientId: 'empresa-secreta', source: 'assignment' },
    ]);

    const respuesta = await controller.clientAccessOfUser('vendedor', req, 'empresa-b');

    expect(respuesta.access).toEqual([{ clientId: 'empresa-b', source: 'own' }]);
    expect((respuesta as { atiendeOtras?: boolean }).atiendeOtras).toBe(true);
    expect(JSON.stringify(respuesta)).not.toContain('empresa-secreta');
  });

  it('da de baja de su empresa a alguien asignado desde otra', async () => {
    // El vendedor es de C y atiende B por asignación; la dueña administra B.
    users.findOne.mockResolvedValue({ id: 'vendedor', role: UserRole.CLIENT, organizationId: 'org-1', clientId: 'empresa-c' });
    alcance.vendedor = ['empresa-c', 'empresa-b'];
    clientAccess.findOne.mockResolvedValue({ id: 'ca-1', reason: null });

    await expect(controller.revokeClientAccess('vendedor', 'empresa-b', req)).resolves.toEqual(expect.objectContaining({ removed: true }));
  });

  it('no da de baja de una empresa que no administra', async () => {
    users.findOne.mockResolvedValue({ id: 'vendedor', role: UserRole.CLIENT, organizationId: 'org-1', clientId: 'empresa-c' });
    alcance.vendedor = ['empresa-c', 'empresa-a'];

    await expect(controller.revokeClientAccess('vendedor', 'empresa-a', req)).rejects.toBeInstanceOf(ForbiddenException);
    expect(clientAccess.remove).not.toHaveBeenCalled();
  });
});

describe('Correos: la empresa que se está mirando', () => {
  const settings = { list: vi.fn().mockResolvedValue([{ key: 'email.reservation_confirmation_enabled' }]), update: vi.fn() };
  const accountAccess = { assertClient: vi.fn().mockResolvedValue(undefined), allowedClientIds: vi.fn() };
  const permisos = { can: vi.fn() };
  const capacidades = { tiene: vi.fn().mockResolvedValue(true) };
  const correo = { send: vi.fn().mockResolvedValue(true) };
  const usuarios = { findOne: vi.fn() };
  let controller: OrganizationSettingsController;
  const req = { organizationId: 'org-1', user: { ...DUENIA, email: 'duenia@a.cl' } } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    accountAccess.allowedClientIds.mockResolvedValue(['empresa-a', 'empresa-b']);
    // Administra B, no A.
    permisos.can.mockImplementation(async (_o: string, _u: string, _r: string, modulo: string, _n: string, empresa?: string) => (
      modulo === 'users' ? empresa === 'empresa-b' : true
    ));
    controller = new OrganizationSettingsController(settings as any, permisos as any, accountAccess as any, capacidades as any, correo as any, usuarios as any);
  });

  it('lee y guarda las plantillas de la empresa que mira, no las de su cuenta', async () => {
    // Antes la empresa pedida se descartaba: mirando B se leían y guardaban las de A.
    await controller.correos(req, 'empresa-b');
    expect(settings.list).toHaveBeenCalledWith('org-1', 'empresa-b');

    await controller.guardarCorreos(req, { values: { 'email.reservation_confirmation_enabled': 'false' } }, 'empresa-b');
    expect(settings.update).toHaveBeenCalledWith('org-1', 'duenia', { 'email.reservation_confirmation_enabled': 'false' }, 'empresa-b');
  });

  it('una empresa que no alcanza cae en la de su cuenta, y ahí no administra', async () => {
    await expect(controller.correos(req, 'empresa-ajena')).rejects.toBeInstanceOf(ForbiddenException);
    expect(settings.list).not.toHaveBeenCalled();
  });

  it('la prueba sólo llega a gente de su empresa', async () => {
    usuarios.findOne.mockResolvedValue(null);

    // El identificador de alguien de la agencia o de otra empresa no encuentra a nadie.
    await expect(controller.probar(req, { destinatarioId: 'alguien-de-la-agencia' }, 'empresa-b')).rejects.toBeInstanceOf(BadRequestException);
    expect(usuarios.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'alguien-de-la-agencia', clientId: 'empresa-b' }),
    }));
    expect(correo.send).not.toHaveBeenCalled();
  });

  it('el equipo interno sigue pudiendo mandarle la prueba a cualquiera del equipo', async () => {
    const interno = { organizationId: 'org-1', user: { id: 'cd', role: UserRole.COMMERCIAL_DIRECTOR, organizationId: 'org-1' } } as any;
    usuarios.findOne.mockResolvedValue({ id: 'x', email: 'x@espartanos.cl' });

    await controller.probar(interno, { destinatarioId: 'x' });

    const where = usuarios.findOne.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('clientId');
    expect(correo.send).toHaveBeenCalled();
  });
});
