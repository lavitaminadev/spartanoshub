import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionResolverService } from '../../../src/core/authorization/permission-resolver.service';
import { PERMISSION_LEVELS, satisfies } from '../../../src/core/authorization/permission-level';
import { roleLevel } from '../../../src/core/authorization/role-permissions';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

function makeResolver(features: Record<string, boolean> | null, overrides: unknown[] = []) {
  const organizations = { findOne: vi.fn().mockResolvedValue({ id: 'org-1', features }) };
  const overrideRepo = { find: vi.fn().mockResolvedValue(overrides) };
  const roleOverrideRepo = { find: vi.fn().mockResolvedValue([]) };
  return {
    resolver: new PermissionResolverService(organizations as never, overrideRepo as never, roleOverrideRepo as never),
    organizations,
    overrideRepo,
    roleOverrideRepo,
  };
}

describe('satisfies', () => {
  it('acepta niveles superiores al requerido', () => {
    expect(satisfies('manage', 'view')).toBe(true);
    expect(satisfies('edit', 'edit')).toBe(true);
    expect(satisfies('view', 'edit')).toBe(false);
    expect(satisfies('none', 'view')).toBe(false);
  });

  it('mantiene los niveles ordenados de menor a mayor', () => {
    expect([...PERMISSION_LEVELS]).toEqual(['none', 'view', 'edit', 'manage']);
  });
});

describe('roleLevel', () => {
  it('otorga administración total al rol admin', () => {
    expect(roleLevel(UserRole.ADMIN, 'billing')).toBe('manage');
    expect(roleLevel(UserRole.ADMIN, 'clientMetricsPanel')).toBe('manage');
  });

  it('devuelve none para un módulo ausente en el mapa del rol', () => {
    expect(roleLevel(UserRole.DESIGNER, 'billing')).toBe('none');
  });

  it('da al community manager edición de reservas y CRM, sin facturación', () => {
    expect(roleLevel(UserRole.COMMUNITY_MANAGER, 'reservations')).toBe('edit');
    expect(roleLevel(UserRole.COMMUNITY_MANAGER, 'crm')).toBe('edit');
    expect(roleLevel(UserRole.COMMUNITY_MANAGER, 'billing')).toBe('none');
  });
});

describe('PermissionResolverService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resuelve el nivel del cargo cuando el módulo está habilitado', async () => {
    const { resolver } = makeResolver({ reservations: true });
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.COMMUNITY_MANAGER);
    expect(permissions.reservations).toBe('edit');
  });

  it('devuelve none en un módulo deshabilitado, incluso para admin', async () => {
    const { resolver } = makeResolver({ billing: false });
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    expect(permissions.billing).toBe('none');
  });

  it('deja los módulos de fases futuras en none por defecto', async () => {
    const { resolver } = makeResolver(null);
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    expect(permissions.clientMetricsPanel).toBe('none');
    expect(permissions.udBudget).toBe('none');
    expect(permissions.reservations).toBe('manage');
    expect(permissions.production).toBe('none');
  });

  it('un modulo visible en producto sigue en none si la organizacion no lo enciende', async () => {
    const { resolver } = makeResolver(null);
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    expect(permissions.production).toBe('none');
  });

  it('un modulo visible y encendido usa el nivel del cargo', async () => {
    const { resolver } = makeResolver({ production: true });
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    expect(permissions.production).toBe('manage');
  });

  it('la excepción del usuario reemplaza el nivel del cargo', async () => {
    const { resolver } = makeResolver(
      { reports: true },
      [{ module: 'reports', level: 'manage' }],
    );
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.DESIGNER);
    expect(permissions.reports).toBe('manage');
  });

  it('la excepción none deniega lo que el cargo concede', async () => {
    const { resolver } = makeResolver(
      { reservations: true },
      [{ module: 'reservations', level: 'none' }],
    );
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.COMMUNITY_MANAGER);
    expect(permissions.reservations).toBe('none');
  });

  it('el módulo deshabilitado prevalece sobre una excepción que concede acceso', async () => {
    const { resolver } = makeResolver(
      { production: false },
      [{ module: 'production', level: 'manage' }],
    );
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.DESIGNER);
    expect(permissions.production).toBe('none');
  });

  it('un módulo oculto por lifecycle queda en none aunque la organización lo encienda', async () => {
    const { resolver } = makeResolver({ udBudget: true });
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    expect(permissions.udBudget).toBe('none');
  });

  it('can compara contra el nivel exigido', async () => {
    const { resolver } = makeResolver({ reservations: true });
    await expect(resolver.can('org-1', 'user-1', UserRole.COMMUNITY_MANAGER, 'reservations', 'view')).resolves.toBe(true);
    await expect(resolver.can('org-1', 'user-1', UserRole.COMMUNITY_MANAGER, 'reservations', 'manage')).resolves.toBe(false);
  });

  it('can niega un módulo desconocido', async () => {
    const { resolver, organizations } = makeResolver({ reservations: true });
    await expect(resolver.can('org-1', 'user-1', UserRole.ADMIN, 'inventado', 'view')).resolves.toBe(false);
    expect(organizations.findOne).not.toHaveBeenCalled();
  });

  it('explain distingue lo heredado del cargo de la excepción', async () => {
    const { resolver } = makeResolver(
      { reports: true, reservations: true, production: false, udBudget: true },
      [{ module: 'reports', level: 'manage' }],
    );
    const modules = await resolver.explain('org-1', 'user-1', UserRole.DESIGNER);
    const byModule = new Map(modules.map((item) => [item.module, item]));
    expect(byModule.get('reports')).toMatchObject({
      level: 'manage',
      source: 'override',
      moduleDisabled: false,
      productHidden: false,
    });
    expect(byModule.get('reservations')).toMatchObject({ source: 'role' });
    expect(byModule.get('production')).toMatchObject({ level: 'none', moduleDisabled: true, productHidden: false });
    expect(byModule.get('udBudget')).toMatchObject({ level: 'none', moduleDisabled: false, productHidden: true });
  });

  it('memoriza y relee después de invalidar el usuario', async () => {
    const { resolver, organizations } = makeResolver({ reservations: true });
    await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    expect(organizations.findOne).toHaveBeenCalledTimes(1);
    resolver.invalidateUser('user-1');
    await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    expect(organizations.findOne).toHaveBeenCalledTimes(2);
  });

  it('invalidar la organización afecta a todos sus usuarios', async () => {
    const { resolver, organizations } = makeResolver({ reservations: true });
    await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    await resolver.permissionsFor('org-1', 'user-2', UserRole.ADMIN);
    expect(organizations.findOne).toHaveBeenCalledTimes(2);
    resolver.invalidateOrganization('org-1');
    await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    await resolver.permissionsFor('org-1', 'user-2', UserRole.ADMIN);
    expect(organizations.findOne).toHaveBeenCalledTimes(4);
  });
});

/**
 * Resolutor con un estado de liberación puesto a mano para un módulo.
 *
 * `lifecycleOf` consulta los parámetros de la agencia; acá se simula ese resolutor para poder
 * fijar el estado sin base de datos.
 */
function makeResolverConEstado(module: string, lifecycle: string, features?: Record<string, boolean>) {
  // El modulo se enciende salvo que la prueba diga lo contrario: varios nacen apagados en el
  // catalogo, y con esos la prueba pasaria por el motivo equivocado.
  const efectivas = features ?? { [module]: true };
  const organizations = { findOne: vi.fn().mockResolvedValue({ id: 'org-1', features: efectivas }) };
  const overrideRepo = { find: vi.fn().mockResolvedValue([]) };
  const roleOverrideRepo = { find: vi.fn().mockResolvedValue([]) };
  const parameters = {
    getManyForOrganization: vi.fn(async (keys: string[]) =>
      new Map(keys.map((key) => [key, key.endsWith(`.${module}`) ? lifecycle : null]))),
    get: vi.fn(async () => null),
  };
  const resolver = new PermissionResolverService(
    organizations as never, overrideRepo as never, roleOverrideRepo as never, parameters as never,
  );
  return resolver;
}

describe('control de liberación', () => {
  it('un cargo normal no alcanza un módulo en desarrollo', async () => {
    const resolver = makeResolverConEstado('production', 'development');
    const permisos = await resolver.permissionsFor('org-1', 'u1', UserRole.ART_DIRECTOR);
    expect(permisos.production).toBe('none');
  });

  it('la administración tampoco: el estado manda sobre el cargo', async () => {
    // Es la razón de que la pregunta por el estado vaya antes que la del permiso. Si fuera al
    // revés, administración vería todo lo que está a medio construir.
    const resolver = makeResolverConEstado('production', 'development');
    const permisos = await resolver.permissionsFor('org-1', 'u1', UserRole.ADMIN);
    expect(permisos.production).toBe('none');
  });

  it('el cargo de desarrollo sí alcanza lo que está en desarrollo', async () => {
    const resolver = makeResolverConEstado('production', 'development');
    const permisos = await resolver.permissionsFor('org-1', 'dev-1', UserRole.DEV);
    expect(permisos.production).not.toBe('none');
  });

  it('desarrollo no salta un módulo apagado para la agencia', async () => {
    // Apagar un módulo es una decisión de negocio, no un estado de liberación. Saltárselo
    // convertiría el cargo en un superusuario invisible.
    const resolver = makeResolverConEstado('production', 'development', { production: false });
    const permisos = await resolver.permissionsFor('org-1', 'dev-1', UserRole.DEV);
    expect(permisos.production).toBe('none');
  });

  it('desarrollo no salta mantenimiento ni deshabilitado', async () => {
    // Si algo está detenido por una corrección, operarlo igual es como se corrompen los datos
    // que se estaban arreglando.
    const enPausa = makeResolverConEstado('production', 'disabled');
    expect((await enPausa.permissionsFor('org-1', 'dev-1', UserRole.DEV)).production).toBe('none');
  });

  it('un módulo activo se comporta igual para todos, sin trato especial de desarrollo', async () => {
    const resolver = makeResolverConEstado('production', 'active');
    const dev = await resolver.permissionsFor('org-1', 'dev-1', UserRole.DEV);
    const director = await resolver.permissionsFor('org-1', 'u1', UserRole.ART_DIRECTOR);
    expect(dev.production).not.toBe('none');
    expect(director.production).not.toBe('none');
  });

  it('la pantalla de permisos muestra lo mismo que aplica el servidor', async () => {
    // Si `explain` calculara aparte, administración vería un nivel distinto del que rige.
    const resolver = makeResolverConEstado('production', 'development');
    const detalle = await resolver.explain('org-1', 'dev-1', UserRole.DEV);
    const production = detalle.find((row) => row.module === 'production');
    expect(production?.productHidden).toBe(false);
    expect(production?.level).not.toBe('none');
  });
});

describe('Intake se libera aparte de Producción', () => {
  /** Resolutor con un estado distinto para cada módulo, que es el caso que motivó separarlos. */
  function conEstados(estados: Record<string, string>) {
    const organizations = { findOne: vi.fn().mockResolvedValue({ id: 'org-1', features: { intake: true, production: true } }) };
    const parameters = {
      getManyForOrganization: vi.fn(async (keys: string[]) => new Map(keys.map((key) => {
        const module = key.split('.').pop() as string;
        return [key, estados[module] ?? null];
      }))),
      get: vi.fn(async () => null),
    };
    return new PermissionResolverService(
      organizations as never,
      { find: vi.fn().mockResolvedValue([]) } as never,
      { find: vi.fn().mockResolvedValue([]) } as never,
      parameters as never,
    );
  }

  it('Intake activo con Producción en desarrollo: se ve la bandeja y no el tablero', async () => {
    // Es la razón de existir de la separación: recibir y coordinar solicitudes está listo,
    // el tablero de piezas con su presupuesto y su XP todavía no.
    const resolver = conEstados({ intake: 'active', production: 'development' });
    const permisos = await resolver.permissionsFor('org-1', 'u1', UserRole.OPERATIONS_DIRECTOR);

    expect(permisos.intake).not.toBe('none');
    expect(permisos.production).toBe('none');
  });

  it('Intake tiene su propio interruptor, independiente del de Producción', async () => {
    const resolver = conEstados({ intake: 'development', production: 'active' });
    const permisos = await resolver.permissionsFor('org-1', 'u1', UserRole.OPERATIONS_DIRECTOR);

    expect(permisos.intake).toBe('none');
    expect(permisos.production).not.toBe('none');
  });

  it('los cargos conservan sobre Intake el nivel que tenían sobre Producción', async () => {
    // La separación es de liberación, no de autorización: nadie debe ganar ni perder acceso
    // por haberla hecho.
    const resolver = conEstados({ intake: 'active', production: 'active' });
    for (const role of [UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.DESIGNER]) {
      const permisos = await resolver.permissionsFor('org-1', `u-${role}`, role);
      expect(permisos.intake, role).toBe(permisos.production);
    }
  });
});
