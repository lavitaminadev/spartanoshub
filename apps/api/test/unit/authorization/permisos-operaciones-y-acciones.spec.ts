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
