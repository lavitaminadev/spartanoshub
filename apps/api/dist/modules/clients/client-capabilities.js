"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CLIENT_CAPABILITIES = exports.CLIENT_CAPABILITY_KEYS = void 0;
exports.normalizeClientCapabilities = normalizeClientCapabilities;
exports.CLIENT_CAPABILITY_KEYS = [
    'reservations',
    'crm',
    'surveys',
    'marketing',
    'metaConversions',
    'googleConversions',
    'budgetVisibility',
];
exports.DEFAULT_CLIENT_CAPABILITIES = {
    reservations: true,
    crm: true,
    surveys: true,
    marketing: false,
    metaConversions: false,
    googleConversions: false,
    budgetVisibility: false,
};
function normalizeClientCapabilities(value) {
    return {
        ...exports.DEFAULT_CLIENT_CAPABILITIES,
        ...(value || {}),
    };
}
