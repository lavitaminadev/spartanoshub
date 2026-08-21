import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OrganizationSettingsController } from '../../../src/core/parameters/organization-settings.controller';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

/**
 * El cierre por dentro.
 *
 * `PUT /settings` está bajo `@ModuleScope('settings')` y es el único endpoint que puede cambiar
 * el ciclo de vida de los módulos, incluido el suyo. Dejar `settings` en un estado no visible
 * devolvía 403 a todo el mundo —también a desarrollo— y no quedaba forma de deshacerlo sin
 * entrar a la base de datos. Ocurrió en producción.
 *
 * `dashboard` es el otro: es la pantalla de aterrizaje de todo cargo interno, y sin ella el
 * inicio de sesión termina en «sin autorización».
 */
function controlador() {
  const settings = { update: vi.fn().mockResolvedValue({ ok: true }), list: vi.fn() };
  return {
    controller: new OrganizationSettingsController(settings as never),
    settings,
  };
}

const DEV = { user: { id: 'u1', role: UserRole.DEV, organizationId: 'org-1' }, organizationId: 'org-1' } as never;

describe('OrganizationSettingsController · no se puede cerrar por dentro', () => {
  it('rechaza dejar settings en un estado que esconde la propia pantalla', () => {
    const { controller, settings } = controlador();

    expect(() => controller.update(DEV, { values: { 'modules.lifecycle.settings': 'disabled' } }))
      .toThrow(BadRequestException);
    // Se rechaza el cambio entero: guardar la mitad dejaría la pantalla mostrando un estado
    // que nadie eligió.
    expect(settings.update).not.toHaveBeenCalled();
  });

  it('rechaza esconder el dashboard, que es la puerta de entrada', () => {
    const { controller } = controlador();

    expect(() => controller.update(DEV, { values: { 'modules.lifecycle.dashboard': 'development' } }))
      .toThrow(BadRequestException);
  });

  it('deja bajarlos a los estados que siguen siendo visibles', () => {
    const { controller, settings } = controlador();

    controller.update(DEV, { values: { 'modules.lifecycle.settings': 'maintenance' } });

    expect(settings.update).toHaveBeenCalledTimes(1);
  });

  it('no toca los demás módulos, que sí se pueden esconder', () => {
    const { controller, settings } = controlador();

    controller.update(DEV, { values: { 'modules.lifecycle.reservations': 'disabled' } });

    expect(settings.update).toHaveBeenCalledTimes(1);
  });

  it('sigue reservando el ciclo de vida a desarrollo', () => {
    const { controller } = controlador();
    const admin = { user: { id: 'u2', role: UserRole.ADMIN, organizationId: 'org-1' }, organizationId: 'org-1' } as never;

    expect(() => controller.update(admin, { values: { 'modules.lifecycle.reservations': 'active' } }))
      .toThrow(ForbiddenException);
  });
});
