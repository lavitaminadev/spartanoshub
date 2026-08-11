"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_VISIBLE_LIFECYCLES = exports.WEB_ONLY_MODULE_CATALOG = exports.ORGANIZATION_MODULE_CATALOG = exports.MODULE_LIFECYCLE_STATUSES = void 0;
exports.isModuleLifecycleVisible = isModuleLifecycleVisible;
exports.getOrganizationModuleLifecycle = getOrganizationModuleLifecycle;
exports.isOrganizationModuleVisible = isOrganizationModuleVisible;
exports.buildDefaultOrganizationModuleLifecycleMap = buildDefaultOrganizationModuleLifecycleMap;
exports.moduleLifecycleSettingKey = moduleLifecycleSettingKey;
exports.MODULE_LIFECYCLE_STATUSES = ['development', 'pilot', 'active', 'maintenance', 'disabled'];
/**
 * Modulos gobernados por la organizacion.
 *
 * `lifecycle` responde "el producto lo ofrece hoy".
 * `defaultEnabled` responde "si creo una organizacion nueva, este modulo parte encendido".
 */
exports.ORGANIZATION_MODULE_CATALOG = [
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
];
/**
 * Modulos de UI sin interruptor por organizacion.
 *
 * Se mantienen en el mismo catalogo conceptual porque el frontend tambien necesita saber
 * si siguen en desarrollo o si ya pueden mostrarse.
 */
exports.WEB_ONLY_MODULE_CATALOG = [
    { key: 'adsInsights', lifecycle: 'development' },
];
exports.PRODUCT_VISIBLE_LIFECYCLES = new Set(['active', 'pilot', 'maintenance']);
function isModuleLifecycleVisible(lifecycle) {
    return exports.PRODUCT_VISIBLE_LIFECYCLES.has(lifecycle);
}
const ORGANIZATION_MODULE_LIFECYCLE_MAP = Object.fromEntries(exports.ORGANIZATION_MODULE_CATALOG.map((item) => [item.key, item.lifecycle]));
function getOrganizationModuleLifecycle(module) {
    return ORGANIZATION_MODULE_LIFECYCLE_MAP[module];
}
function isOrganizationModuleVisible(module) {
    return isModuleLifecycleVisible(getOrganizationModuleLifecycle(module));
}
function buildDefaultOrganizationModuleLifecycleMap() {
    return Object.fromEntries(exports.ORGANIZATION_MODULE_CATALOG.map((item) => [item.key, item.lifecycle]));
}
function moduleLifecycleSettingKey(module) {
    return `modules.lifecycle.${module}`;
}
//# sourceMappingURL=modules.js.map