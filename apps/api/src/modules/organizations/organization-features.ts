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
export const REQUIRED_ORGANIZATION_FEATURE_KEYS = [
  'dashboard',
  /*
    `settings` gobierna `PUT /settings`, que es el único endpoint capaz de cambiar el ciclo de
    vida de los módulos —incluido el suyo—. Apagarlo cierra la puerta por dentro: la pantalla
    responde 403 a todo el mundo, también a desarrollo, y no queda forma de volver a encenderlo
    sin entrar a la base de datos. Ocurrió en producción.
  */
  'settings',
] as const satisfies readonly OrganizationFeatureKey[];

/**
 * Módulos cuyo ciclo de vida no se puede bajar por debajo de visible.
 *
 * Es la misma protección que `REQUIRED_ORGANIZATION_FEATURE_KEYS`, para el otro interruptor:
 * el estado del producto bloquea igual que el de la organización, y `disabled` bloquea incluso
 * a desarrollo. Sin esta lista se podía dejar el sistema sin pantalla de aterrizaje —`dashboard`
 * en deshabilitado— o sin forma de deshacerlo —`settings`—.
 */
export const REQUIRED_LIFECYCLE_KEYS: readonly OrganizationFeatureKey[] = REQUIRED_ORGANIZATION_FEATURE_KEYS;

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
  // Esta regla debe vivir también al leer configuraciones antiguas. La validación del
  // endpoint impide apagar estos módulos hacia adelante, pero organizaciones que ya
  // tenían el valor guardado en falso dejaban a todo el equipo redirigido a /404 al
  // iniciar sesión. Un requisito de acceso no puede depender de un dato histórico.
  for (const key of REQUIRED_ORGANIZATION_FEATURE_KEYS) result[key] = true;
  return result;
}

export function isOrganizationFeatureKey(value: string): value is OrganizationFeatureKey {
  return (ORGANIZATION_FEATURE_KEYS as readonly string[]).includes(value);
}
