import {
  buildDefaultOrganizationModuleLifecycleMap,
  ORGANIZATION_MODULE_CATALOG,
  WEB_ONLY_MODULE_CATALOG,
  isModuleInInitialOperationScope,
  isModuleLifecycleVisible,
  type ProductModuleKey,
  type ModuleLifecycleStatus,
} from '@espartanos/shared';

/**
 * Interruptor maestro.
 *
 * Se conserva para poder reabrir todo el producto en una sola decisión, pero el detalle ya
 * no vive en listas manuales: se deriva del catálogo compartido.
 */
export const PHASE_SCOPE_ENABLED = true;

const PRODUCT_MODULE_CATALOG = [...ORGANIZATION_MODULE_CATALOG, ...WEB_ONLY_MODULE_CATALOG] as const;

const MODULE_LIFECYCLE = Object.fromEntries(
  PRODUCT_MODULE_CATALOG.map((item) => [item.key, item.lifecycle]),
) as Record<ProductModuleKey, ModuleLifecycleStatus>;

/**
 * Módulos visibles hoy según el catálogo de producto.
 *
 * Se exporta para mantener trazabilidad en pruebas y documentación interna.
 */
export const PHASE_1_MODULES: readonly string[] = PRODUCT_MODULE_CATALOG
  .filter((item) => isModuleLifecycleVisible(item.lifecycle))
  .map((item) => item.key);

/**
 * Módulos existentes pero aún ocultos al usuario final.
 *
 * El valor es el estado de lifecycle para que se vea por qué están fuera.
 */
export const OUT_OF_SCOPE_MODULES: Readonly<Record<string, ModuleLifecycleStatus>> = Object.fromEntries(
  PRODUCT_MODULE_CATALOG
    .filter((item) => !isModuleLifecycleVisible(item.lifecycle))
    .map((item) => [item.key, item.lifecycle]),
);

/**
 * Indica si un módulo forma parte de la oferta visible del producto.
 *
 * Un módulo desconocido se deja pasar para que registrar una feature nueva no la esconda por
 * accidente; ocultarla requiere declararla en el catálogo.
 */
export function isModuleInPhaseScope(
  module?: string,
  organizationLifecycle?: Partial<Record<string, ModuleLifecycleStatus>>,
  userRole?: string,
): boolean {
  if (!PHASE_SCOPE_ENABLED) return true;
  if (!module) return true;
  if (!isModuleInInitialOperationScope(module, userRole)) return false;
  const lifecycle = (organizationLifecycle?.[module]
    ?? buildDefaultOrganizationModuleLifecycleMap()[module as keyof ReturnType<typeof buildDefaultOrganizationModuleLifecycleMap>]
    ?? MODULE_LIFECYCLE[module as ProductModuleKey]) as ModuleLifecycleStatus | undefined;
  if (!lifecycle) return true;
  if (isModuleLifecycleVisible(lifecycle)) return true;

  // Debe coincidir con `PermissionResolverService`: desarrollo valida lo que está en
  // `development`, pero no los módulos explícitamente `disabled`. `maintenance` ya salió por
  // la rama visible anterior y permanece disponible como estado operativo.
  return userRole === 'dev' && lifecycle === 'development';
}
