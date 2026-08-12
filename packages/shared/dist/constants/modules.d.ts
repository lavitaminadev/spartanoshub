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
export declare const MODULE_LIFECYCLE_STATUSES: readonly ["development", "pilot", "active", "maintenance", "disabled"];
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
export declare const ORGANIZATION_MODULE_CATALOG: readonly [{
    readonly key: "dashboard";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "settings";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "users";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "clients";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "reports";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "integrations";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "reservations";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "crm";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}, {
    readonly key: "commercialPipeline";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}, {
    readonly key: "production";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}, {
    readonly key: "clientMetricsPanel";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "multiClientOnboarding";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "udBudget";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "gamification";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "billing";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "contracts";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "catalog";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "content";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "briefs";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "meetings";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "documents";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "approvals";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "audiovisual";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "knowledge";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "onboarding";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "operations";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "governance";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "direction";
    readonly lifecycle: "development";
    readonly defaultEnabled: false;
}, {
    readonly key: "surveys";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}];
export type OrganizationModuleKey = (typeof ORGANIZATION_MODULE_CATALOG)[number]['key'];
export declare const AGENCY_CORE_MODULE_KEYS: readonly ["dashboard", "settings", "users", "clients", "reports", "integrations", "reservations", "crm", "surveys"];
export type OrganizationFeaturesMap = Record<OrganizationModuleKey, boolean>;
export declare function buildAgencyCoreOrganizationFeatures(): OrganizationFeaturesMap;
/**
 * Modulos de UI sin interruptor por organizacion.
 *
 * Se mantienen en el mismo catalogo conceptual porque el frontend tambien necesita saber
 * si siguen en desarrollo o si ya pueden mostrarse.
 */
export declare const WEB_ONLY_MODULE_CATALOG: readonly [{
    readonly key: "adsInsights";
    readonly lifecycle: "development";
}];
export type WebOnlyModuleKey = (typeof WEB_ONLY_MODULE_CATALOG)[number]['key'];
export type ProductModuleKey = OrganizationModuleKey | WebOnlyModuleKey;
export declare const PRODUCT_VISIBLE_LIFECYCLES: Set<"active" | "development" | "pilot" | "maintenance" | "disabled">;
export declare function isModuleLifecycleVisible(lifecycle: ModuleLifecycleStatus): boolean;
export declare function getOrganizationModuleLifecycle(module: OrganizationModuleKey): ModuleLifecycleStatus;
export declare function isOrganizationModuleVisible(module: OrganizationModuleKey): boolean;
export type OrganizationModuleLifecycleMap = Record<OrganizationModuleKey, ModuleLifecycleStatus>;
export declare function buildDefaultOrganizationModuleLifecycleMap(): OrganizationModuleLifecycleMap;
export declare function moduleLifecycleSettingKey(module: OrganizationModuleKey): `modules.lifecycle.${OrganizationModuleKey}`;
//# sourceMappingURL=modules.d.ts.map