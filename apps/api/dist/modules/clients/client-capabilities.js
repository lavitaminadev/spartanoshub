"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CLIENT_CAPABILITIES = exports.CLIENT_CAPABILITY_KEYS = void 0;
exports.normalizeClientCapabilities = normalizeClientCapabilities;
exports.CLIENT_CAPABILITY_KEYS = ['reservations', 'crm', 'metaConversions', 'googleConversions'];
exports.DEFAULT_CLIENT_CAPABILITIES = {
    reservations: true,
    crm: true,
    metaConversions: false,
    googleConversions: false,
};
function normalizeClientCapabilities(value) {
    return {
        ...exports.DEFAULT_CLIENT_CAPABILITIES,
        ...(value || {}),
    };
}
//# sourceMappingURL=client-capabilities.js.map