"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ORGANIZATION_FEATURES = exports.ORGANIZATION_FEATURE_KEYS = void 0;
exports.normalizeOrganizationFeatures = normalizeOrganizationFeatures;
exports.isOrganizationFeatureKey = isOrganizationFeatureKey;
exports.ORGANIZATION_FEATURE_KEYS = [
    'dashboard',
    'clients',
    'users',
    'reservations',
    'crm',
    'integrations',
    'settings',
    'clientMetricsPanel',
    'multiClientOnboarding',
    'production',
    'udBudget',
    'gamification',
    'billing',
    'contracts',
    'catalog',
    'content',
    'briefs',
    'meetings',
    'documents',
    'approvals',
    'audiovisual',
    'knowledge',
    'reports',
    'onboarding',
    'operations',
    'governance',
    'direction',
    'commercialPipeline',
];
exports.DEFAULT_ORGANIZATION_FEATURES = {
    dashboard: true,
    clients: true,
    users: true,
    reservations: true,
    crm: true,
    integrations: true,
    settings: true,
    clientMetricsPanel: false,
    multiClientOnboarding: false,
    production: false,
    udBudget: false,
    gamification: false,
    billing: false,
    contracts: false,
    catalog: false,
    content: false,
    briefs: false,
    meetings: false,
    documents: false,
    approvals: false,
    audiovisual: false,
    knowledge: false,
    reports: false,
    onboarding: false,
    operations: false,
    governance: false,
    direction: false,
    commercialPipeline: false,
};
function normalizeOrganizationFeatures(value) {
    const result = { ...exports.DEFAULT_ORGANIZATION_FEATURES };
    for (const key of exports.ORGANIZATION_FEATURE_KEYS) {
        const provided = value?.[key];
        if (typeof provided === 'boolean')
            result[key] = provided;
    }
    return result;
}
function isOrganizationFeatureKey(value) {
    return exports.ORGANIZATION_FEATURE_KEYS.includes(value);
}
//# sourceMappingURL=organization-features.js.map