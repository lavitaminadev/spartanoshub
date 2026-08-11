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
  { key: 'dashboard', lifecycle: 'active', defaultEnabled: true },
  { key: 'clients', lifecycle: 'active', defaultEnabled: true },
  { key: 'users', lifecycle: 'active', defaultEnabled: true },
  { key: 'reservations', lifecycle: 'active', defaultEnabled: true },
  { key: 'crm', lifecycle: 'active', defaultEnabled: true },
  { key: 'integrations', lifecycle: 'active', defaultEnabled: true },
  { key: 'settings', lifecycle: 'active', defaultEnabled: true },

  { key: 'clientMetricsPanel', lifecycle: 'development', defaultEnabled: false },
  { key: 'multiClientOnboarding', lifecycle: 'development', defaultEnabled: false },

  { key: 'production', lifecycle: 'active', defaultEnabled: false },
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
  { key: 'reports', lifecycle: 'active', defaultEnabled: false },
  { key: 'onboarding', lifecycle: 'development', defaultEnabled: false },
  { key: 'operations', lifecycle: 'development', defaultEnabled: false },
  { key: 'governance', lifecycle: 'development', defaultEnabled: false },
  { key: 'direction', lifecycle: 'development', defaultEnabled: false },
  { key: 'commercialPipeline', lifecycle: 'active', defaultEnabled: false },
] as const satisfies readonly ProductModuleDefinition[];

export type OrganizationModuleKey = (typeof ORGANIZATION_MODULE_CATALOG)[number]['key'];

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
