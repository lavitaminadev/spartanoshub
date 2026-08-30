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
  // Sin empresa elegida no hay nada que comprobar; con ella, esto es la reja de alcance.
  const accountAccess = { assertClient: vi.fn().mockResolvedValue(undefined) };
  return {
    controller: new OrganizationSettingsController(settings as never, accountAccess as never),
    settings,
  };
}

const DEV = { user: { id: 'u1', role: UserRole.DEV, organizationId: 'org-1' }, organizationId: 'org-1' } as never;

describe('OrganizationSettingsController · no se puede cerrar por dentro', () => {
  it('rechaza dejar settings en un estado que esconde la propia pantalla', async () => {
    const { controller, settings } = controlador();

    // La comprobacion llega como promesa rechazada porque el metodo es asincrono: para NestJS es
    // equivalente, el filtro de excepciones trata las dos igual.
    await expect(controller.update(DEV, { values: { 'modules.lifecycle.settings': 'disabled' } }))
      .rejects.toThrow(BadRequestException);
    // Se rechaza el cambio entero: guardar la mitad dejaría la pantalla mostrando un estado
    // que nadie eligió.
    expect(settings.update).not.toHaveBeenCalled();
  });

  it('rechaza esconder el dashboard, que es la puerta de entrada', async () => {
    const { controller } = controlador();

    await expect(controller.update(DEV, { values: { 'modules.lifecycle.dashboard': 'development' } }))
      .rejects.toThrow(BadRequestException);
  });

  it('deja bajarlos a los estados que siguen siendo visibles', async () => {
    const { controller, settings } = controlador();

    await controller.update(DEV, { values: { 'modules.lifecycle.settings': 'maintenance' } });

    expect(settings.update).toHaveBeenCalledTimes(1);
  });

  it('no toca los demás módulos, que sí se pueden esconder', async () => {
    const { controller, settings } = controlador();

    await controller.update(DEV, { values: { 'modules.lifecycle.reservations': 'disabled' } });

    expect(settings.update).toHaveBeenCalledTimes(1);
  });

  it('sigue reservando el ciclo de vida a desarrollo', async () => {
    const { controller } = controlador();
    const admin = { user: { id: 'u2', role: UserRole.ADMIN, organizationId: 'org-1' }, organizationId: 'org-1' } as never;

    await expect(controller.update(admin, { values: { 'modules.lifecycle.reservations': 'active' } }))
      .rejects.toThrow(ForbiddenException);
  });
});
