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

  /*
   * Qué le falta al servidor de correo es información de operación: nombra las variables con que
   * está montado. Quien administra reservas no puede entrar al servidor a resolverlo, así que sólo
   * necesita saber que aún no está activo.
   */
  it('sólo desarrollo ve qué le falta al servidor de correo', () => {
    const correo = { estado: () => ({ habilitado: false, remitente: null, servidor: null, puerto: null, respuestasA: null, faltan: ['SMTP_ENABLED=true', 'SMTP_HOST'] }) };
    const conCorreo = new OrganizationSettingsController(settings as any, accountAccess as any, correo as any, {} as any);

    const comoAdmin = conCorreo.estadoDelCorreo({ user: { role: UserRole.ADMIN } } as any);
    const comoDev = conCorreo.estadoDelCorreo({ user: { role: UserRole.DEV } } as any);

    expect(comoAdmin.faltan).toEqual([]);
    expect(comoAdmin.habilitado).toBe(false);
    expect(comoDev.faltan).toEqual(['SMTP_ENABLED=true', 'SMTP_HOST']);
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

  it('Correos sólo lee y guarda plantillas de correo, nunca el resto de la configuración', async () => {
    const request = { organizationId: 'org-1', user: { id: 'cd-1', role: UserRole.COMMERCIAL_DIRECTOR } } as any;
    settings.list.mockResolvedValue([{ key: 'email.reservation_confirmation_enabled' }, { key: 'security.password.expiryDays' }]);
    await expect(controller.correos(request)).resolves.toEqual([{ key: 'email.reservation_confirmation_enabled' }]);

    await expect(controller.guardarCorreos(request, { values: { 'email.reservation_confirmation_subject': 'Hola', 'modules.lifecycle.production': 'active' } })).rejects.toThrow(ForbiddenException);
    expect(settings.update).not.toHaveBeenCalled();

    await controller.guardarCorreos(request, { values: { 'email.reservation_confirmation_subject': 'Hola' } }, 'c-1');
    expect(accountAccess.assertClient).toHaveBeenCalledWith('org-1', request.user, 'c-1');
    expect(settings.update).toHaveBeenCalledWith('org-1', 'cd-1', { 'email.reservation_confirmation_subject': 'Hola' }, 'c-1');
  });
});
