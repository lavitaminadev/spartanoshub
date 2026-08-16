import {
  buildDefaultOrganizationModuleLifecycleMap,
  ORGANIZATION_MODULE_CATALOG,
  WEB_ONLY_MODULE_CATALOG,
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
  const lifecycle = (organizationLifecycle?.[module]
    ?? buildDefaultOrganizationModuleLifecycleMap()[module as keyof ReturnType<typeof buildDefaultOrganizationModuleLifecycleMap>]
    ?? MODULE_LIFECYCLE[module as ProductModuleKey]) as ModuleLifecycleStatus | undefined;
  if (!lifecycle) return true;
  if (isModuleLifecycleVisible(lifecycle)) return true;

  /*
   * El cargo de desarrollo no queda fuera de ninguna ruta por su estado de liberación.
   *
   * La intención original era acotar la excepción a `development`, para que el menú dijera lo
   * mismo que el servidor y no ofreciera módulos cuyas rutas terminarían en 403. Pero acotarla
   * dejó a desarrollo **fuera de rutas a las que sí podía entrar**: `isPathEnabled` devuelve
   * `false` y `ProtectedRoute` redirige a `/404`, así que un módulo en mantenimiento —o
   * simplemente sin estado resuelto— saca a quien tiene que poder revisarlo.
   *
   * Dejar pasar de más en el menú es recuperable: si el servidor no lo autoriza, responde 403 y
   * se ve el error. Dejar pasar de menos no lo es: la ruta desaparece y no hay nada que
   * diagnosticar desde la pantalla. Por eso vuelve a ser el cargo, y no el estado, lo que decide.
   *
   * El enforcement real sigue en el servidor, donde `alcanzaElModulo` sí acota la excepción a
   * `development`. Esta capa es navegación, no autorización.
   */
  return userRole === 'dev';
}
