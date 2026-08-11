import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  buildDefaultOrganizationModuleLifecycleMap,
  isModuleLifecycleVisible,
  moduleLifecycleSettingKey,
  type ModuleLifecycleStatus,
  type OrganizationModuleLifecycleMap,
} from '@vitahub/shared';
import { Repository } from 'typeorm';
import { Organization } from '../../modules/organizations/organization.entity';
import {
  ORGANIZATION_FEATURE_KEYS, OrganizationFeatureKey, OrganizationFeatures,
  isOrganizationFeatureKey, normalizeOrganizationFeatures,
} from '../../modules/organizations/organization-features';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { UserPermissionOverride } from './user-permission-override.entity';
import { PermissionLevel, satisfies } from './permission-level';
import { roleLevel } from './role-permissions';
import { ParameterResolver } from '../parameters/parameter-resolver.service';

/** Nivel efectivo por módulo, con la procedencia de cada valor. */
export interface EffectivePermission {
  module: OrganizationFeatureKey;
  level: PermissionLevel;
  /** `role` cuando proviene del cargo, `override` cuando una excepción lo modificó. */
  source: 'role' | 'override';
  /** `true` si el módulo está deshabilitado en la organización. */
  moduleDisabled: boolean;
  /** `true` si el producto aún no expone el módulo a usuarios finales. */
  productHidden: boolean;
}

export type PermissionMap = Record<OrganizationFeatureKey, PermissionLevel>;

/**
 * Resuelve qué puede hacer un usuario sobre cada módulo.
 *
 * El nivel efectivo surge de tres condiciones evaluadas en cadena:
 *
 * 1. El módulo debe estar visible en el catálogo de producto. Si sigue en desarrollo, el
 *    nivel es `none` para todos.
 * 2. El módulo debe estar habilitado en la organización. Si no lo está, el nivel es `none`
 *    para todos, incluida la administración.
 * 3. El cargo define el nivel base (`role-permissions.ts`).
 * 4. Una excepción por usuario, si existe, reemplaza ese nivel.
 *
 * Es la única fuente de verdad de la autorización por módulo: tanto los guards del backend
 * como el menú del frontend derivan de acá, de modo que no pueden discrepar.
 */
@Injectable()
export class PermissionResolverService {
  private static readonly CACHE_TTL_MS = 30_000;
  private readonly cache = new Map<string, { permissions: PermissionMap; expiresAt: number }>();

  constructor(
    @InjectRepository(Organization) private readonly organizations: Repository<Organization>,
    @InjectRepository(UserPermissionOverride) private readonly overrides: Repository<UserPermissionOverride>,
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

    const [features, lifecycleMap, overrides] = await Promise.all([
      this.featuresOf(organizationId),
      this.lifecycleOf(organizationId),
      this.overrides.find({ where: { organizationId, userId } }),
    ]);
    const overrideByModule = new Map(overrides.map((item) => [item.module, item.level]));

    const permissions = Object.fromEntries(
      ORGANIZATION_FEATURE_KEYS.map((module) => [
        module,
        isModuleLifecycleVisible(lifecycleMap[module]) && features[module]
          ? overrideByModule.get(module) ?? roleLevel(role, module)
          : 'none',
      ]),
    ) as PermissionMap;

    this.cache.set(cacheKey, { permissions, expiresAt: Date.now() + PermissionResolverService.CACHE_TTL_MS });
    return permissions;
  }

  /**
   * Detalle por módulo con la procedencia del nivel, para mostrarlo en administración de
   * usuarios: permite distinguir lo heredado del cargo de lo ajustado a mano.
   */
  async explain(organizationId: string, userId: string, role: UserRole): Promise<EffectivePermission[]> {
    const [features, lifecycleMap, overrides] = await Promise.all([
      this.featuresOf(organizationId),
      this.lifecycleOf(organizationId),
      this.overrides.find({ where: { organizationId, userId } }),
    ]);
    const overrideByModule = new Map(overrides.map((item) => [item.module, item.level]));

    return ORGANIZATION_FEATURE_KEYS.map((module) => {
      const override = overrideByModule.get(module);
      const moduleDisabled = !features[module];
      const productHidden = !isModuleLifecycleVisible(lifecycleMap[module]);
      return {
        module,
        level: productHidden || moduleDisabled ? 'none' : override ?? roleLevel(role, module),
        source: override ? 'override' : 'role',
        moduleDisabled,
        productHidden,
      };
    });
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

  /** Descarta lo memorizado de una organización tras cambiar sus módulos habilitados. */
  invalidateOrganization(organizationId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${organizationId}:`)) this.cache.delete(key);
    }
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
    if (!this.parameters) return defaults;
    const configured = await Promise.all(
      ORGANIZATION_FEATURE_KEYS.map(async (module) => {
        const value = await this.parameters.get(moduleLifecycleSettingKey(module), null, null, organizationId);
        return [module, value] as const;
      }),
    );

    for (const [module, value] of configured) {
      if (typeof value === 'string') defaults[module] = value as ModuleLifecycleStatus;
    }
    return defaults;
  }
}
