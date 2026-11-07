/**
 * Dirección de operaciones ajusta a su equipo sin escalar privilegios, y las acciones finas
 * siguen al nivel del módulo salvo ajuste personal.
 */

import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PermissionsController } from '../../../src/core/authorization/permissions.controller';
import { AccionesService } from '../../../src/core/authorization/acciones.service';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

function controlador(objetivo: { id: string; role: UserRole }, propios: Record<string, string> = { crm: 'edit' }) {
  const permissions = { permissionsFor: vi.fn().mockResolvedValue(propios), invalidateUser: vi.fn() };
  const overrides = { findOne: vi.fn().mockResolvedValue(null), save: vi.fn(async (v) => ({ id: 'o1', ...v })), remove: vi.fn() };
  const users = { findOne: vi.fn().mockResolvedValue({ ...objetivo, organizationId: 'org' }) };
  const c = new PermissionsController(permissions as never, overrides as never, {} as never, users as never, {} as never, {} as never, {} as never, { log: vi.fn() } as never, {} as never, {} as never);
  const req = (role: UserRole) => ({ organizationId: 'org', user: { id: 'yo', role } }) as never;
  return { c, overrides, req };
}

describe('Dirección de operaciones ajusta permisos de su equipo', () => {
  it('puede ajustar a una community manager dentro de su propio nivel', async () => {
    const { c, overrides, req } = controlador({ id: 'cm', role: UserRole.COMMUNITY_MANAGER });
    await c.upsert('cm', 'crm', { level: 'view' } as never, req(UserRole.OPERATIONS_DIRECTOR));
    expect(overrides.save).toHaveBeenCalled();
  });

  it('no concede más de lo que tiene', async () => {
    const { c, req } = controlador({ id: 'cm', role: UserRole.COMMUNITY_MANAGER });
    await expect(c.upsert('cm', 'crm', { level: 'manage' } as never, req(UserRole.OPERATIONS_DIRECTOR))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no ajusta a Administración ni toca Usuarios, y nadie se ajusta a sí mismo', async () => {
    const admin = controlador({ id: 'adm', role: UserRole.ADMIN });
    await expect(admin.c.upsert('adm', 'crm', { level: 'view' } as never, admin.req(UserRole.OPERATIONS_DIRECTOR))).rejects.toBeInstanceOf(ForbiddenException);
    const cm = controlador({ id: 'cm', role: UserRole.COMMUNITY_MANAGER });
    await expect(cm.c.upsert('cm', 'users', { level: 'view' } as never, cm.req(UserRole.OPERATIONS_DIRECTOR))).rejects.toBeInstanceOf(ForbiddenException);
    const yo = controlador({ id: 'yo', role: UserRole.COMMUNITY_MANAGER });
    await expect(yo.c.upsert('yo', 'crm', { level: 'view' } as never, yo.req(UserRole.ADMIN))).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('acciones por persona', () => {
  function servicio(niveles: Record<string, string>, ajustes: Array<{ action: string; allowed: boolean }> = []) {
    return new AccionesService({ find: vi.fn().mockResolvedValue(ajustes) } as never, { permissionsFor: vi.fn().mockResolvedValue(niveles) } as never);
  }

  it('sin ajuste, la acción sigue al nivel del módulo (como antes)', async () => {
    const s = servicio({ crm: 'edit', surveys: 'edit' });
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'crm.importar')).toBe(true);
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'surveys.borrar')).toBe(false);
  });

  it('un ajuste cierra o abre la acción para esa persona', async () => {
    const s = servicio({ crm: 'edit', surveys: 'edit' }, [{ action: 'crm.importar', allowed: false }, { action: 'surveys.borrar', allowed: true }]);
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'crm.importar')).toBe(false);
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'surveys.borrar')).toBe(true);
  });

  it('un ajuste nunca abre una acción de un módulo al que no entra', async () => {
    const s = servicio({ crm: 'none' }, [{ action: 'crm.importar', allowed: true }]);
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'crm.importar')).toBe(false);
  });
});

/**
 * Un ajuste de acción rige en la empresa en que se concedió, y no en las demás.
 *
 * Es el defecto que la 0189 vino a cerrar. `user_action_overrides` tenía clave `(persona, acción)`
 * y ninguna columna de empresa, mientras la pantalla ofrecía elegir el local y mostraba el ajuste
 * bajo el elegido: conceder una acción en un local la concedía en todos, y nada lo decía.
 *
 * La regla es la misma que ya aplicaban las excepciones de módulo, y tiene que ser la misma para
 * que las dos mitades de la misma pantalla no se contradigan.
 */
describe('un ajuste de acción vale en su empresa', () => {
  function servicio(ajustes: Array<{ action: string; allowed: boolean; clientId?: string | null; expiresAt?: Date }>) {
    return new AccionesService(
      { find: vi.fn().mockResolvedValue(ajustes) } as never,
      { permissionsFor: vi.fn().mockResolvedValue({ crm: 'edit' }) } as never,
    );
  }

  it('el de una empresa no rige en otra', async () => {
    const s = servicio([{ action: 'crm.importar', allowed: false, clientId: 'casa-costanera' }]);
    // En el local donde se concedió, manda el ajuste.
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'crm.importar', 'casa-costanera')).toBe(false);
    // En el de al lado, la acción vuelve a seguir el nivel del módulo.
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'crm.importar', 'bar-ruperto')).toBe(true);
    // Y sin empresa en la pregunta tampoco se aplica: no se sabe en cuál se está.
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'crm.importar')).toBe(true);
  });

  /**
   * El vacío sigue significando «en todas sus empresas».
   *
   * Es lo que hacían todos los ajustes antes de la 0189, y por eso la migración no convierte
   * ninguna fila: nadie cambia de accesos el día del despliegue. Para el equipo interno además es
   * la lectura correcta —su alcance es su pod, no una empresa—.
   */
  it('el general rige en todas, y también sin empresa', async () => {
    const s = servicio([{ action: 'crm.importar', allowed: false, clientId: null }]);
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'crm.importar', 'casa-costanera')).toBe(false);
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'crm.importar', 'bar-ruperto')).toBe(false);
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'crm.importar')).toBe(false);
  });

  it('el de la empresa que se mira gana sobre el general', async () => {
    const s = servicio([
      { action: 'crm.importar', allowed: false, clientId: null },
      { action: 'crm.importar', allowed: true, clientId: 'casa-costanera' },
    ]);
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'crm.importar', 'casa-costanera')).toBe(true);
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'crm.importar', 'bar-ruperto')).toBe(false);
  });

  it('el orden en que llegan las filas no cambia el resultado', async () => {
    // La resolución recorre la lista: si el general llegara después del de la empresa y se
    // escribiera encima, lo particular perdería según el orden que devolviera la base.
    const s = servicio([
      { action: 'crm.importar', allowed: true, clientId: 'casa-costanera' },
      { action: 'crm.importar', allowed: false, clientId: null },
    ]);
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'crm.importar', 'casa-costanera')).toBe(true);
  });

  it('uno vencido no rige, ni siquiera en su empresa', async () => {
    const s = servicio([{ action: 'crm.importar', allowed: false, clientId: 'casa-costanera', expiresAt: new Date(Date.now() - 1000) }]);
    expect(await s.puede('org', 'u', UserRole.COMMUNITY_MANAGER, 'crm.importar', 'casa-costanera')).toBe(true);
  });

  it('dice de qué empresa es el ajuste que manda, para que la pantalla pueda decirlo', async () => {
    const s = servicio([{ action: 'crm.importar', allowed: false, clientId: null }]);
    const acciones = await s.explicar('org', 'u', UserRole.COMMUNITY_MANAGER, 'casa-costanera');
    const importar = acciones.find((accion) => accion.clave === 'crm.importar');
    expect(importar?.origen).toBe('ajuste');
    // `null` con origen «ajuste»: vale en todas. La pantalla ofrece acotarlo con eso.
    expect(importar?.empresaDelAjuste).toBeNull();
  });
});
