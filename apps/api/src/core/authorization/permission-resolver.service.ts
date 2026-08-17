import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  buildDefaultOrganizationModuleLifecycleMap,
  isModuleLifecycleVisible,
  moduleLifecycleSettingKey,
  type ModuleLifecycleStatus,
  type OrganizationModuleLifecycleMap,
} from '@espartanos/shared';
import { Repository } from 'typeorm';
import { Organization } from '../../modules/organizations/organization.entity';
import {
  ORGANIZATION_FEATURE_KEYS, OrganizationFeatureKey, OrganizationFeatures,
  isOrganizationFeatureKey, normalizeOrganizationFeatures,
} from '../../modules/organizations/organization-features';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { UserPermissionOverride } from './user-permission-override.entity';
import { RolePermissionOverride } from './role-permission-override.entity';
import { PermissionLevel, satisfies } from './permission-level';
import { roleLevel } from './role-permissions';
import { ParameterResolver } from '../parameters/parameter-resolver.service';

/** Nivel efectivo por módulo, con la procedencia de cada valor. */
export interface EffectivePermission {
  module: OrganizationFeatureKey;
  level: PermissionLevel;
  /** `role` cuando proviene del cargo, `override` cuando una excepción lo modificó. */
  source: 'role' | 'override';
  /** `true` si el nivel del cargo viene de un ajuste de la matriz y no del código. */
  roleAdjusted: boolean;
  /** `true` si el módulo está deshabilitado en la organización. */
  moduleDisabled: boolean;
  /** `true` si el producto aún no expone el módulo a usuarios finales. */
  productHidden: boolean;
}

export type PermissionMap = Record<OrganizationFeatureKey, PermissionLevel>;

/** Procedencia de una celda de la matriz de cargos. */
export type RoleMatrixSource = 'code' | 'override';

/** Matriz de cargos resuelta, con la procedencia de cada celda. */
export interface ResolvedRoleMatrix {
  matrix: Record<string, Record<string, PermissionLevel>>;
  sources: Record<string, Record<string, RoleMatrixSource>>;
}

/** Clave con la que se indexa una celda de la matriz de cargos. */
function cellKey(role: string, module: string): string {
  return `${role}:${module}`;
}

/**
 * Resuelve qué puede hacer un usuario sobre cada módulo.
 *
 * El nivel efectivo surge de estas condiciones evaluadas en cadena:
 *
 * 1. El módulo debe estar visible en el catálogo de producto. Si sigue en desarrollo, el
 *    nivel es `none` para todos salvo el cargo de desarrollo, que es quien valida una
 *    funcionalidad desplegada antes de liberarla al equipo.
 * 2. El módulo debe estar habilitado en la organización. Si no lo está, el nivel es `none`
 *    para todos, incluida la administración.
 * 3. El cargo define el nivel base: `role-permissions.ts`, salvo que la organización haya
 *    ajustado esa celda en `role_permission_overrides`.
 * 4. Una excepción por usuario vigente, si existe, reemplaza ese nivel.
 *
 * Es la única fuente de verdad de la autorización por módulo: tanto los guards del backend
 * como el menú del frontend derivan de acá, de modo que no pueden discrepar.
 *
 * Todo lo que se consulta en el camino caliente vive detrás del mismo memorizado de 30
 * segundos, incluidos los ajustes de la matriz de cargos: agregarlos no agrega consultas por
 * petición. El precio es que un cambio tarda hasta ese tiempo en verse, salvo que se invalide
 * de forma explícita, que es lo que hacen los endpoints que los modifican.
 */
@Injectable()
export class PermissionResolverService {
  private static readonly CACHE_TTL_MS = 30_000;
  private readonly cache = new Map<string, { permissions: PermissionMap; expiresAt: number }>();
  private readonly roleOverrideCache = new Map<string, { levels: Map<string, PermissionLevel>; expiresAt: number }>();

  constructor(
    @InjectRepository(Organization) private readonly organizations: Repository<Organization>,
    @InjectRepository(UserPermissionOverride) private readonly overrides: Repository<UserPermissionOverride>,
    @InjectRepository(RolePermissionOverride) private readonly roleOverrides: Repository<RolePermissionOverride>,
    private readonly parameters?: ParameterResolver,
  ) {}

  /**
   * Nivel efectivo de un usuario sobre cada módulo.
   *
   * @param organizationId - Organización del usuario.
   * @param userId - Usuario a resolver.
   * @param role - Cargo del usuario.
   */
  async permissionsFor(organizationId: string, userId: string, role: UserRole): Promise<PermissionMap> {
    const cacheKey = `${organizationId}:${userId}:${role}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.permissions;

    const [features, lifecycleMap, overrides, roleLevels] = await Promise.all([
      this.featuresOf(organizationId),
      this.lifecycleOf(organizationId),
      this.overrides.find({ where: { organizationId, userId } }),
      this.roleLevelsOf(organizationId),
    ]);
    const overrideByModule = this.activeOverrides(overrides);

    const permissions = Object.fromEntries(
      ORGANIZATION_FEATURE_KEYS.map((module) => [
        module,
        this.alcanzaElModulo(role, lifecycleMap[module], features[module])
          ? overrideByModule.get(module)?.level ?? roleLevels.get(cellKey(role, module)) ?? roleLevel(role, module)
          : 'none',
      ]),
    ) as PermissionMap;

    this.cache.set(cacheKey, { permissions, expiresAt: Date.now() + PermissionResolverService.CACHE_TTL_MS });
    return permissions;
  }

  /**
   * Si el estado del módulo deja que alguien de este cargo llegue a él.
   *
   * Es la primera de las cuatro preguntas de la autorización, y va antes que el permiso a
   * propósito: preguntar el permiso primero haría que un administrador viera los módulos en
   * desarrollo por ser administrador, que es justo lo que se quiere evitar. El estado del módulo
   * no es un permiso —es si la funcionalidad está liberada— y por eso manda.
   *
   * El cargo de desarrollo es la única excepción, y existe para separar dos cosas que hasta ahora
   * eran la misma: **desplegar el código** y **liberarlo al uso**. Sin esta excepción, validar una
   * funcionalidad en la infraestructura real obligaba a ponerla visible para todo el equipo, que
   * es exactamente lo que no se quiere después de un despliegue con diferencias entre entornos.
   *
   * La excepción alcanza solo a `development`. Un módulo **apagado** para la agencia sigue
   * apagado también para desarrollo: apagarlo es una decisión de negocio, no un estado de
   * liberación, y saltársela convertiría el cargo en un superusuario invisible.
   *
   * `maintenance` y `disabled` tampoco se saltan: si una funcionalidad está detenida por una
   * corrección, que desarrollo pueda operarla igual es cómo se corrompen los datos que se estaban
   * arreglando.
   */
  private alcanzaElModulo(role: UserRole, lifecycle: ModuleLifecycleStatus, moduleEnabled: boolean): boolean {
    if (!moduleEnabled) return false;
    if (isModuleLifecycleVisible(lifecycle)) return true;
    return role === UserRole.DEV && lifecycle === 'development';
  }

  /**
   * Detalle por módulo con la procedencia del nivel, para mostrarlo en administración de
   * usuarios: permite distinguir lo heredado del cargo de lo ajustado a mano.
   */
  async explain(organizationId: string, userId: string, role: UserRole): Promise<EffectivePermission[]> {
    const [features, lifecycleMap, overrides, roleLevels] = await Promise.all([
      this.featuresOf(organizationId),
      this.lifecycleOf(organizationId),
      this.overrides.find({ where: { organizationId, userId } }),
      this.roleLevelsOf(organizationId),
    ]);
    const overrideByModule = this.activeOverrides(overrides);

    return ORGANIZATION_FEATURE_KEYS.map((module) => {
      const override = overrideByModule.get(module);
      const adjusted = roleLevels.get(cellKey(role, module));
      const moduleDisabled = !features[module];
      // Se usa la misma funcion que decide de verdad: si la pantalla de permisos calculara
      // aparte, mostraria un nivel distinto del que el servidor aplica.
      const productHidden = !this.alcanzaElModulo(role, lifecycleMap[module], features[module]) && features[module];
      const base = adjusted ?? roleLevel(role, module);
      return {
        module,
        level: productHidden || moduleDisabled ? 'none' : override?.level ?? base,
        source: override ? 'override' : 'role',
        roleAdjusted: adjusted !== undefined,
        moduleDisabled,
        productHidden,
      };
    });
  }

  /**
   * Matriz completa de cargos resuelta para una organización.
   *
   * Devuelve el nivel de cada celda y de dónde sale: `code` cuando lo define
   * `role-permissions.ts`, `override` cuando la organización lo ajustó. Es lo que permite que
   * el panel muestre qué está en su valor por defecto y qué fue movido a mano.
   */
  async roleMatrix(organizationId: string): Promise<ResolvedRoleMatrix> {
    const roleLevels = await this.roleLevelsOf(organizationId);
    const matrix: Record<string, Record<string, PermissionLevel>> = {};
    const sources: Record<string, Record<string, RoleMatrixSource>> = {};

    for (const module of ORGANIZATION_FEATURE_KEYS) {
      matrix[module] = {};
      sources[module] = {};
      for (const role of Object.values(UserRole)) {
        const adjusted = roleLevels.get(cellKey(role, module));
        matrix[module][role] = adjusted ?? roleLevel(role, module);
        sources[module][role] = adjusted === undefined ? 'code' : 'override';
      }
    }
    return { matrix, sources };
  }

  /** Nivel que el código define para una celda, sin considerar ajustes ni excepciones. */
  codeLevel(role: UserRole, module: OrganizationFeatureKey): PermissionLevel {
    return roleLevel(role, module);
  }

  /**
   * Comprueba si un usuario alcanza el nivel exigido sobre un módulo.
   *
   * @param module - Clave del módulo; una clave desconocida se considera denegada.
   */
  async can(
    organizationId: string,
    userId: string,
    role: UserRole,
    module: string,
    required: PermissionLevel,
  ): Promise<boolean> {
    if (!isOrganizationFeatureKey(module)) return false;
    const permissions = await this.permissionsFor(organizationId, userId, role);
    return satisfies(permissions[module], required);
  }

  /** Descarta lo memorizado de un usuario tras cambiar sus excepciones. */
  invalidateUser(userId: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(`:${userId}:`)) this.cache.delete(key);
    }
  }

  /**
   * Descarta lo memorizado de una organización tras cambiar sus módulos habilitados o la
   * matriz de sus cargos. Alcanza a los permisos de todas sus personas, porque el nivel de
   * cualquiera de ellas puede depender de lo que cambió.
   */
  invalidateOrganization(organizationId: string): void {
    this.roleOverrideCache.delete(organizationId);
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${organizationId}:`)) this.cache.delete(key);
    }
  }

  /**
   * Excepciones por módulo que están vigentes ahora.
   *
   * Una excepción vencida se descarta en la resolución, no solo en la pantalla: dejarla
   * aplicando mientras se muestra como vencida es exactamente el fallo que el vencimiento
   * pretende evitar.
   */
  private activeOverrides(overrides: UserPermissionOverride[]): Map<string, UserPermissionOverride> {
    const now = Date.now();
    const result = new Map<string, UserPermissionOverride>();
    for (const item of overrides) {
      if (item.expiresAt && item.expiresAt.getTime() <= now) continue;
      result.set(item.module, item);
    }
    return result;
  }

  /**
   * Ajustes de la matriz de cargos de una organización, indexados por `cargo:módulo`.
   *
   * Se memoriza por organización con el mismo tiempo de vida que los permisos, de modo que la
   * consulta ocurre como máximo una vez cada 30 segundos por organización y no una vez por
   * petición.
   */
  private async roleLevelsOf(organizationId: string): Promise<Map<string, PermissionLevel>> {
    const cached = this.roleOverrideCache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) return cached.levels;

    const rows = await this.roleOverrides.find({ where: { organizationId } });
    const levels = new Map(rows.map((row) => [cellKey(row.role, row.module), row.level]));
    this.roleOverrideCache.set(organizationId, {
      levels,
      expiresAt: Date.now() + PermissionResolverService.CACHE_TTL_MS,
    });
    return levels;
  }

  private async featuresOf(organizationId: string): Promise<OrganizationFeatures> {
    const organization = await this.organizations.findOne({
      where: { id: organizationId },
      select: ['id', 'features'],
    });
    return normalizeOrganizationFeatures(organization?.features);
  }

  private async lifecycleOf(organizationId: string): Promise<OrganizationModuleLifecycleMap> {
    const defaults = buildDefaultOrganizationModuleLifecycleMap();
    // El servicio de parámetros es opcional: se resuelve una sola vez a una constante local para
    // que las consultas en paralelo trabajen sobre una referencia ya verificada.
    const parameters = this.parameters;
    if (!parameters) return defaults;
    // En lote y no una por módulo: son 31, y `get` cuesta dos consultas cada vez —definición y
    // valor—, así que resolverlas de a una eran 62 viajes a la base en cada petición con la
    // caché fría. El lote las deja en dos.
    const configured = await parameters.getManyForOrganization(
      ORGANIZATION_FEATURE_KEYS.map((module) => moduleLifecycleSettingKey(module)),
      organizationId,
    );

    for (const module of ORGANIZATION_FEATURE_KEYS) {
      const value = configured.get(moduleLifecycleSettingKey(module));
      if (typeof value === 'string') defaults[module] = value as ModuleLifecycleStatus;
    }
    return defaults;
  }
}
