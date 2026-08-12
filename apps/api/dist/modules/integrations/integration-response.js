"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toIntegrationResponse = toIntegrationResponse;
exports.toIntegrationAccountResponse = toIntegrationAccountResponse;
exports.assertConfigHasNoSecrets = assertConfigHasNoSecrets;
const common_1 = require("@nestjs/common");
const SECRET_CONFIG_KEYS = new Set([
    'accessToken',
    'refreshToken',
    'clientSecret',
    'apiKey',
    'token',
]);
function isSecretKey(key) {
    const normalized = key.replace(/[_-]/g, '').toLowerCase();
    return SECRET_CONFIG_KEYS.has(key) || ['accesstoken', 'refreshtoken', 'clientsecret', 'apikey', 'password', 'privatekey', 'token'].includes(normalized);
}
function sanitizeValue(value) {
    if (Array.isArray(value))
        return value.map(sanitizeValue);
    if (!value || typeof value !== 'object')
        return value;
    return Object.fromEntries(Object.entries(value)
        .filter(([key]) => !isSecretKey(key))
        .map(([key, nested]) => [key, sanitizeValue(nested)]));
}
function toIntegrationResponse(integration) {
    const config = sanitizeValue(integration.config ?? {});
    return { ...integration, config };
}
function toIntegrationAccountResponse(account) {
    const { accessToken: _accessToken, refreshToken: _refreshToken, ...safe } = account;
    return safe;
}
function assertConfigHasNoSecrets(config) {
    if (!config)
        return;
    const secretKey = Object.keys(config).find(isSecretKey);
    if (secretKey) {
        throw new common_1.BadRequestException(`Integration secret '${secretKey}' must be configured through its OAuth flow`);
    }
}
