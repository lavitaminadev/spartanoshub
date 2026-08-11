"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveOAuthRedirect = resolveOAuthRedirect;
const common_1 = require("@nestjs/common");
const environment_1 = require("../../config/environment");
function configuredAppUrl() {
    return process.env.APP_PUBLIC_URL;
}
function resolveOAuthRedirect(provider, requested) {
    const fallback = configuredAppUrl();
    const raw = requested || (fallback ? `${fallback.replace(/\/$/, '')}/integrations/${provider}/callback` : undefined);
    if (!raw)
        throw new common_1.BadRequestException('APP_PUBLIC_URL is required for OAuth');
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        throw new common_1.BadRequestException('Invalid OAuth redirect URL');
    }
    const expectedPath = `/integrations/${provider}/callback`;
    if (url.pathname !== expectedPath || url.search || url.hash || url.username || url.password) {
        throw new common_1.BadRequestException('OAuth redirect URL is not allowed');
    }
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
        throw new common_1.BadRequestException('OAuth redirect URL must use HTTPS');
    }
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
        throw new common_1.BadRequestException('OAuth redirect URL must use HTTPS');
    }
    const allowedOrigins = new Set((0, environment_1.parseCorsOrigins)());
    if (fallback) {
        try {
            allowedOrigins.add(new URL(fallback).origin);
        }
        catch { }
    }
    if (!allowedOrigins.has(url.origin))
        throw new common_1.BadRequestException('OAuth redirect origin is not allowed');
    return `${url.origin}${url.pathname}`;
}
//# sourceMappingURL=oauth-redirect.js.map