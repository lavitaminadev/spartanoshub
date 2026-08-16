import {
  ORGANIZATION_MODULE_CATALOG,
  type OrganizationModuleKey,
} from '@espartanos/shared';

/**
 * Modulos que se pueden encender o apagar por organizacion.
 *
 * La lista sale del catalogo compartido para que backend y frontend hablen del mismo
 * conjunto de modulos y del mismo estado de producto.
 */
export const ORGANIZATION_FEATURE_KEYS = ORGANIZATION_MODULE_CATALOG.map((item) => item.key) as readonly OrganizationModuleKey[];

export type OrganizationFeatureKey = OrganizationModuleKey;
export type OrganizationFeatures = Record<OrganizationFeatureKey, boolean>;

/**
 * Módulos que sostienen el acceso básico de la aplicación.
 *
 * `dashboard` es el destino de todo cargo interno después de autenticarse. Permitir que se
 * apague desde la configuración convierte un cambio de catálogo en un bloqueo masivo que el
 * frontend muestra como 404. Los permisos por cargo y por persona siguen siendo la fuente de
 * verdad de quién puede usarlo; esta lista solo impide desactivar la puerta de entrada común.
 */
export const REQUIRED_ORGANIZATION_FEATURE_KEYS = ['dashboard'] as const satisfies readonly OrganizationFeatureKey[];

/**
 * Valor inicial por organizacion.
 *
 * Deriva del catalogo compartido: si el producto muestra un modulo hoy, eso no obliga a
 * que una organizacion nueva lo tenga encendido; ambas decisiones quedan declaradas en el
 * mismo lugar.
 */
export const DEFAULT_ORGANIZATION_FEATURES: OrganizationFeatures = Object.fromEntries(
  ORGANIZATION_MODULE_CATALOG.map((item) => [item.key, item.defaultEnabled]),
) as OrganizationFeatures;

/** Rellena las claves ausentes con el valor por defecto y descarta las desconocidas. */
export function normalizeOrganizationFeatures(value?: Partial<OrganizationFeatures> | null): OrganizationFeatures {
  const result = { ...DEFAULT_ORGANIZATION_FEATURES };
  for (const key of ORGANIZATION_FEATURE_KEYS) {
    const provided = value?.[key];
    if (typeof provided === 'boolean') result[key] = provided;
  }
  return result;
}

export function isOrganizationFeatureKey(value: string): value is OrganizationFeatureKey {
  return (ORGANIZATION_FEATURE_KEYS as readonly string[]).includes(value);
}
