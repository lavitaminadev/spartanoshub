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
/** Etiqueta en español de cada estado de ciclo de vida, para mostrarla al usuario. */
export declare const MODULE_LIFECYCLE_LABELS: Record<ModuleLifecycleStatus, string>;
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
 *
 * Los doce modulos cuyo sujeto es una empresa atendida parten **apagados**. Hasta ahora decian
 * `true` y no se notaba, porque `INITIAL_OPERATION_MODULES` rechazaba la ruta antes de mirarlos;
 * al liberar esa reja, dejarlos en `true` los habria encendido de golpe para todo cargo que la
 * matriz alcanza. Apagados, encenderlos es un acto: Desarrollo en Accesos y seguridad -> Modulos
 * para la organizacion, y la capacidad contratada para cada empresa.
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
    readonly defaultEnabled: true;
}, {
    readonly key: "commercialPipeline";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "production";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}, {
    readonly key: "intake";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}, {
    readonly key: "clientMetricsPanel";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "multiClientOnboarding";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "udBudget";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}, {
    readonly key: "gamification";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "billing";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}, {
    readonly key: "contracts";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}, {
    readonly key: "catalog";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "content";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}, {
    readonly key: "briefs";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}, {
    readonly key: "meetings";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}, {
    readonly key: "documents";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}, {
    readonly key: "approvals";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}, {
    readonly key: "audiovisual";
    readonly lifecycle: "active";
    readonly defaultEnabled: false;
}, {
    readonly key: "knowledge";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "onboarding";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "operations";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "governance";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "direction";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "surveys";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}, {
    readonly key: "marketing";
    readonly lifecycle: "active";
    readonly defaultEnabled: true;
}];
export type OrganizationModuleKey = (typeof ORGANIZATION_MODULE_CATALOG)[number]['key'];
export declare const AGENCY_CORE_MODULE_KEYS: readonly ["dashboard", "settings", "users", "clients", "reports", "integrations", "reservations", "governance", "crm", "surveys"];
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
    readonly lifecycle: "active";
}];
export type WebOnlyModuleKey = (typeof WEB_ONLY_MODULE_CATALOG)[number]['key'];
export type ProductModuleKey = OrganizationModuleKey | WebOnlyModuleKey;
/**
 * Superficie operativa inicial. El código de los demás módulos permanece en
 * el producto, pero no se entrega a los cargos operativos hasta que Desarrollo
 * decida liberarlo. Esta puerta no sustituye los permisos: los recorta antes
 * de que el menú o la API puedan ofrecer una ruta por accidente.
 */
export declare const INITIAL_OPERATION_MODULES: Set<string>;
/** Desarrollo conserva visibilidad total; los demás parten con CRM/Reservas mínimos. */
export declare function isModuleInInitialOperationScope(module: string | undefined, role?: string): boolean;
export declare const PRODUCT_VISIBLE_LIFECYCLES: Set<"development" | "pilot" | "active" | "maintenance" | "disabled">;
export declare function isModuleLifecycleVisible(lifecycle: ModuleLifecycleStatus): boolean;
export declare function getOrganizationModuleLifecycle(module: OrganizationModuleKey): ModuleLifecycleStatus;
export declare function isOrganizationModuleVisible(module: OrganizationModuleKey): boolean;
export type OrganizationModuleLifecycleMap = Record<OrganizationModuleKey, ModuleLifecycleStatus>;
export declare function buildDefaultOrganizationModuleLifecycleMap(): OrganizationModuleLifecycleMap;
export declare function moduleLifecycleSettingKey(module: OrganizationModuleKey): `modules.lifecycle.${OrganizationModuleKey}`;
//# sourceMappingURL=modules.d.ts.map