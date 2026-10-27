"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CLIENT_CAPABILITIES = exports.CLIENT_CAPABILITY_KEYS = exports.CAPACIDADES_DE_MODULO = void 0;
exports.normalizeClientCapabilities = normalizeClientCapabilities;
exports.CAPACIDADES_DE_MODULO = [
    'production',
    'audiovisual',
    'content',
    'approvals',
    'meetings',
    'documents',
    'briefs',
    'billing',
    'contracts',
    'intake',
    'reports',
    'commercialPipeline',
];
exports.CLIENT_CAPABILITY_KEYS = [
    'reservations',
    'crm',
    'surveys',
    'marketing',
    'metaConversions',
    'googleConversions',
    'budgetVisibility',
    'detalleDeContactoEnAvisos',
    ...exports.CAPACIDADES_DE_MODULO,
];
exports.DEFAULT_CLIENT_CAPABILITIES = {
    reservations: true,
    crm: true,
    surveys: true,
    marketing: false,
    metaConversions: false,
    googleConversions: false,
    budgetVisibility: false,
    detalleDeContactoEnAvisos: false,
    production: false,
    audiovisual: false,
    content: false,
    approvals: false,
    meetings: false,
    documents: false,
    briefs: false,
    billing: false,
    contracts: false,
    intake: false,
    reports: false,
    commercialPipeline: false,
};
function normalizeClientCapabilities(value) {
    return {
        ...exports.DEFAULT_CLIENT_CAPABILITIES,
        ...(value || {}),
    };
}
