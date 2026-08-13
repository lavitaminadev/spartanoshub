/**
 * @fileoverview Catalogo unico de modulos del producto.
 *
 * Centraliza dos decisiones que antes estaban duplicadas:
 * - si el modulo forma parte de la oferta visible del producto hoy;
 * - si, cuando una organizacion nueva se crea, ese modulo nace encendido o apagado.
 *
 * El backend usa este catalogo para resolver permisos efectivos y valores por defecto.
 * El frontend lo usa para decidir si un modulo puede mostrarse siquiera.
 */

export const MODULE_LIFECYCLE_STATUSES = ['development', 'pilot', 'active', 'maintenance', 'disabled'] as const;
export type ModuleLifecycleStatus = (typeof MODULE_LIFECYCLE_STATUSES)[number];

/** Etiqueta en español de cada estado de ciclo de vida, para mostrarla al usuario. */
export const MODULE_LIFECYCLE_LABELS: Record<ModuleLifecycleStatus, string> = {
  development: 'En desarrollo',
  pilot: 'Piloto',
  active: 'Activo',
  maintenance: 'En mantenimiento',
  disabled: 'Deshabilitado',
};

export interface ProductModuleDefinition<Key extends string = string> {
  key: Key;
  lifecycle: ModuleLifecycleStatus;
  defaultEnabled: boolean;
}

/**
 * Modulos gobernados por la organizacion.
 *
 * `lifecycle` responde "el producto lo ofrece hoy".
 * `defaultEnabled` responde "si creo una organizacion nueva, este modulo parte encendido".
 */
export const ORGANIZATION_MODULE_CATALOG = [
  // Base minima: sin estos modulos la aplicacion no se puede usar. No es una preferencia
  // comercial, es lo que sostienen los guardias del backend:
  // - `dashboard` es la pantalla de aterrizaje de todo cargo que no sea cliente.
  // - `settings` gobierna `/settings` y `/organizations` (de ahi salen los interruptores).
  // - `users` gobierna `/users` y `/roles/permissions` (la matriz del panel de administracion).
  // - `clients` gobierna `GET /clients`, que consultan las cinco pantallas de reservas para
  //   poblar el selector de cuenta; sin el, no se puede crear un formulario de reserva.
  // - `reports` gobierna `/reporting/*`, de donde el dashboard y el pulso toman sus datos.
  // - `integrations` gobierna `/integrations/meta/*`, que es como una reserva se convierte en
  //   conversion enviada a Meta: apagarlo deja la captacion sin su ultimo tramo.
  { key: 'dashboard', lifecycle: 'active', defaultEnabled: true },
  { key: 'settings', lifecycle: 'active', defaultEnabled: true },
  { key: 'users', lifecycle: 'active', defaultEnabled: true },
  { key: 'clients', lifecycle: 'active', defaultEnabled: true },
  { key: 'reports', lifecycle: 'active', defaultEnabled: true },
  { key: 'integrations', lifecycle: 'active', defaultEnabled: true },

  // Operacion en produccion hoy: reservas y su circuito de captacion.
  { key: 'reservations', lifecycle: 'active', defaultEnabled: true },

  // Ofrecidos por el producto y listos para usarse, pero apagados de fabrica: quedan a un
  // interruptor de distancia en el panel de administracion, sin tocar codigo.
  { key: 'crm', lifecycle: 'active', defaultEnabled: false },
  { key: 'commercialPipeline', lifecycle: 'active', defaultEnabled: false },
  { key: 'production', lifecycle: 'active', defaultEnabled: false },

  // En desarrollo: el producto todavia no los ofrece, asi que encenderlos no los hace
  // visibles. Para abrir uno hay que subir su `lifecycle`, no solo su interruptor.
  { key: 'clientMetricsPanel', lifecycle: 'development', defaultEnabled: false },
  { key: 'multiClientOnboarding', lifecycle: 'development', defaultEnabled: false },
  { key: 'udBudget', lifecycle: 'development', defaultEnabled: false },
  { key: 'gamification', lifecycle: 'development', defaultEnabled: false },
  { key: 'billing', lifecycle: 'development', defaultEnabled: false },
  { key: 'contracts', lifecycle: 'development', defaultEnabled: false },
  { key: 'catalog', lifecycle: 'development', defaultEnabled: false },
  { key: 'content', lifecycle: 'development', defaultEnabled: false },
  { key: 'briefs', lifecycle: 'development', defaultEnabled: false },
  { key: 'meetings', lifecycle: 'development', defaultEnabled: false },
  { key: 'documents', lifecycle: 'development', defaultEnabled: false },
  { key: 'approvals', lifecycle: 'development', defaultEnabled: false },
  { key: 'audiovisual', lifecycle: 'development', defaultEnabled: false },
  { key: 'knowledge', lifecycle: 'development', defaultEnabled: false },
  { key: 'onboarding', lifecycle: 'development', defaultEnabled: false },
  { key: 'operations', lifecycle: 'development', defaultEnabled: false },
  { key: 'governance', lifecycle: 'development', defaultEnabled: false },
  { key: 'direction', lifecycle: 'development', defaultEnabled: false },
  // Encuestas propias, distintas de la encuesta post-visita que ya vive dentro de reservas.
  // Su API existe (`SurveysController`), asi que el producto ya la ofrece; nace apagada
  // porque distribuir una encuesta es una decision de cada organizacion, no un valor por
  // defecto, y queda a un interruptor de distancia en el panel de administracion.
  { key: 'surveys', lifecycle: 'active', defaultEnabled: false },
] as const satisfies readonly ProductModuleDefinition[];

export type OrganizationModuleKey = (typeof ORGANIZATION_MODULE_CATALOG)[number]['key'];

export const AGENCY_CORE_MODULE_KEYS = [
  'dashboard',
  'settings',
  'users',
  'clients',
  'reports',
  'integrations',
  'reservations',
  'crm',
  'surveys',
] as const satisfies readonly OrganizationModuleKey[];

const AGENCY_CORE_MODULE_SET = new Set<OrganizationModuleKey>(AGENCY_CORE_MODULE_KEYS);

export type OrganizationFeaturesMap = Record<OrganizationModuleKey, boolean>;

export function buildAgencyCoreOrganizationFeatures(): OrganizationFeaturesMap {
  return Object.fromEntries(
    ORGANIZATION_MODULE_CATALOG.map((item) => [item.key, AGENCY_CORE_MODULE_SET.has(item.key)]),
  ) as OrganizationFeaturesMap;
}

/**
 * Modulos de UI sin interruptor por organizacion.
 *
 * Se mantienen en el mismo catalogo conceptual porque el frontend tambien necesita saber
 * si siguen en desarrollo o si ya pueden mostrarse.
 */
export const WEB_ONLY_MODULE_CATALOG = [
  { key: 'adsInsights', lifecycle: 'development' },
] as const;

export type WebOnlyModuleKey = (typeof WEB_ONLY_MODULE_CATALOG)[number]['key'];
export type ProductModuleKey = OrganizationModuleKey | WebOnlyModuleKey;

export const PRODUCT_VISIBLE_LIFECYCLES = new Set<ModuleLifecycleStatus>(['active', 'pilot', 'maintenance']);

export function isModuleLifecycleVisible(lifecycle: ModuleLifecycleStatus): boolean {
  return PRODUCT_VISIBLE_LIFECYCLES.has(lifecycle);
}

const ORGANIZATION_MODULE_LIFECYCLE_MAP = Object.fromEntries(
  ORGANIZATION_MODULE_CATALOG.map((item) => [item.key, item.lifecycle]),
) as Record<OrganizationModuleKey, ModuleLifecycleStatus>;

export function getOrganizationModuleLifecycle(module: OrganizationModuleKey): ModuleLifecycleStatus {
  return ORGANIZATION_MODULE_LIFECYCLE_MAP[module];
}

export function isOrganizationModuleVisible(module: OrganizationModuleKey): boolean {
  return isModuleLifecycleVisible(getOrganizationModuleLifecycle(module));
}

export type OrganizationModuleLifecycleMap = Record<OrganizationModuleKey, ModuleLifecycleStatus>;

export function buildDefaultOrganizationModuleLifecycleMap(): OrganizationModuleLifecycleMap {
  return Object.fromEntries(
    ORGANIZATION_MODULE_CATALOG.map((item) => [item.key, item.lifecycle]),
  ) as OrganizationModuleLifecycleMap;
}

export function moduleLifecycleSettingKey(module: OrganizationModuleKey): `modules.lifecycle.${OrganizationModuleKey}` {
  return `modules.lifecycle.${module}`;
}
