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
  it('reserva el catálogo completo para Desarrollo', () => {
    for (const modulo of ['users', 'billing', 'crm', 'clientMetricsPanel', 'reservations'] as const) {
      expect(roleLevel(UserRole.DEV, modulo), `dev debería administrar ${modulo}`).toBe('manage');
    }
  });

  it('no entrega administración total a los demás cargos internos', () => {
    for (const rol of Object.values(UserRole).filter((rol) => ![UserRole.DEV, UserRole.CLIENT].includes(rol))) {
      expect(roleLevel(rol, 'clientMetricsPanel'), `${rol} no debe administrar el sistema`).not.toBe('manage');
    }
    expect(roleLevel(UserRole.ADMIN, 'users')).toBe('manage');
    expect(roleLevel(UserRole.COMMUNITY_MANAGER, 'reservations')).toBe('edit');
    expect(roleLevel(UserRole.DESIGNER, 'crm')).toBe('none');
  });

  it('deja al cargo de cliente con su perfil acotado', () => {
    // Es el único que no pertenece a la agencia. Abrirle el catálogo expondría los datos de
    // unas cuentas a las personas de otras, que es lo que el alcance por cuenta impide.
    expect(roleLevel(UserRole.CLIENT, 'reservations')).toBe('edit');
    expect(roleLevel(UserRole.CLIENT, 'clients')).toBe('view');
    expect(roleLevel(UserRole.CLIENT, 'billing')).toBe('none');
    expect(roleLevel(UserRole.CLIENT, 'users')).toBe('none');
  });

  it('devuelve none para un módulo que no existe en el catálogo', () => {
    expect(roleLevel(UserRole.DESIGNER, 'modulo-inventado')).toBe('none');
  });
});

describe('PermissionResolverService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resuelve el nivel del cargo cuando el módulo está habilitado', async () => {
    const { resolver } = makeResolver({ reservations: true });
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.COMMUNITY_MANAGER);
    expect(permissions.reservations).toBe('manage');
  });

  it('devuelve none en un módulo deshabilitado, incluso para admin', async () => {
    const { resolver } = makeResolver({ billing: false });
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    expect(permissions.billing).toBe('none');
  });

  /**
   * El interruptor por organización sigue mandando sobre el cargo.
   *
   * Es lo único que no cambió al abrir la matriz, y es lo que importa que siga en pie: dar el
   * catálogo completo al equipo no puede significar que apagar un módulo deje de surtir efecto.
   */
  it('un módulo apagado por la organización queda en none para cualquier cargo del equipo', async () => {
    const { resolver } = makeResolver({ production: false, udBudget: false });
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.COMMERCIAL_DIRECTOR);
    expect(permissions.production).toBe('none');
    expect(permissions.udBudget).toBe('none');
  });

  it('sin configuración guardada, la organización arranca con el catálogo encendido', async () => {
    // Antes 22 de los 31 módulos venían apagados y había que buscarlos en el panel para poder
    // usarlos: una instalación nueva se veía incompleta sin que nada lo explicara.
    const { resolver } = makeResolver(null);
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    expect(permissions.production).toBe('manage');
    expect(permissions.crm).toBe('manage');
    expect(permissions.clientMetricsPanel).toBe('manage');
  });

  it('un módulo visible y encendido usa el nivel del cargo', async () => {
    const { resolver } = makeResolver({ users: true });
    const permissions = await resolver.permissionsFor('org-1', 'user-1', UserRole.ADMIN);
    expect(permissions.users).toBe('manage');
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

  /*
    Acá vivía «un módulo oculto por lifecycle queda en none aunque la organización lo encienda».
    Se retiró porque no probaba eso: pasaba porque `admin` no tenía `udBudget` en la matriz, y
    los 31 módulos del catálogo están en `active`, así que no hay ninguno que el ciclo de vida
    oculte. Una prueba con ese nombre habría seguido en verde ante una regresión real de
    lifecycle. Cuando vuelva a haber un módulo en fase futura, la prueba se escribe con él.
  */

  it('can compara contra el nivel exigido', async () => {
    const { resolver } = makeResolver({ reservations: true, billing: true });
    // El equipo administra; el cargo de cliente es el que se queda corto, y por eso sirve para
    // comprobar que la comparación de niveles distingue de verdad.
    await expect(resolver.can('org-1', 'user-1', UserRole.COMMUNITY_MANAGER, 'reservations', 'manage')).resolves.toBe(true);
    await expect(resolver.can('org-1', 'user-1', UserRole.CLIENT, 'reservations', 'edit')).resolves.toBe(true);
    await expect(resolver.can('org-1', 'user-1', UserRole.CLIENT, 'reservations', 'manage')).resolves.toBe(false);
    await expect(resolver.can('org-1', 'user-1', UserRole.CLIENT, 'billing', 'view')).resolves.toBe(false);
  });

  it('can niega un módulo desconocido', async () => {
    const { resolver, organizations } = makeResolver({ reservations: true });
    await expect(resolver.can('org-1', 'user-1', UserRole.ADMIN, 'inventado', 'view')).resolves.toBe(false);
    expect(organizations.findOne).not.toHaveBeenCalled();
  });

  it('explain distingue lo heredado del cargo de la excepción', async () => {
    const { resolver } = makeResolver(
      { reports: true, reservations: true, production: false },
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
    // `productHidden` ya no se puede provocar desde el catálogo: todos los módulos están
    // activos y abrirlos o cerrarlos se decide en configuración. El bloque «control de
    // liberación», más abajo, lo ejerce por esa vía, que es la única que queda.
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
