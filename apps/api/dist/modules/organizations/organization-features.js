"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ORGANIZATION_FEATURES = exports.REQUIRED_ORGANIZATION_FEATURE_KEYS = exports.ORGANIZATION_FEATURE_KEYS = void 0;
exports.normalizeOrganizationFeatures = normalizeOrganizationFeatures;
exports.isOrganizationFeatureKey = isOrganizationFeatureKey;
const shared_1 = require("@espartanos/shared");
exports.ORGANIZATION_FEATURE_KEYS = shared_1.ORGANIZATION_MODULE_CATALOG.map((item) => item.key);
exports.REQUIRED_ORGANIZATION_FEATURE_KEYS = ['dashboard'];
exports.DEFAULT_ORGANIZATION_FEATURES = Object.fromEntries(shared_1.ORGANIZATION_MODULE_CATALOG.map((item) => [item.key, item.defaultEnabled]));
function normalizeOrganizationFeatures(value) {
    const result = { ...exports.DEFAULT_ORGANIZATION_FEATURES };
    for (const key of exports.ORGANIZATION_FEATURE_KEYS) {
        const provided = value?.[key];
        if (typeof provided === 'boolean')
            result[key] = provided;
    }
    for (const key of exports.REQUIRED_ORGANIZATION_FEATURE_KEYS)
        result[key] = true;
    return result;
}
function isOrganizationFeatureKey(value) {
    return exports.ORGANIZATION_FEATURE_KEYS.includes(value);
}
