"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOAuthState = createOAuthState;
exports.verifyOAuthState = verifyOAuthState;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
function stateSecret() {
    const secret = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET;
    if (!secret)
        throw new Error('OAUTH_STATE_SECRET or JWT_SECRET is required');
    return secret;
}
function createOAuthState(provider, organizationId, redirectUri) {
    const payload = {
        provider,
        organizationId,
        redirectUri,
        expiresAt: Date.now() + 10 * 60 * 1000,
        nonce: (0, node_crypto_1.randomBytes)(16).toString('base64url'),
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = (0, node_crypto_1.createHmac)('sha256', stateSecret()).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
}
function verifyOAuthState(state, expected) {
    const [encoded, signature, ...extra] = state.split('.');
    if (!encoded || !signature || extra.length)
        throw new common_1.BadRequestException('Invalid OAuth state');
    const calculated = (0, node_crypto_1.createHmac)('sha256', stateSecret()).update(encoded).digest();
    const received = Buffer.from(signature, 'base64url');
    if (calculated.length !== received.length || !(0, node_crypto_1.timingSafeEqual)(calculated, received)) {
        throw new common_1.BadRequestException('Invalid OAuth state');
    }
    try {
        const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        if (payload.expiresAt < Date.now()
            || payload.provider !== expected.provider
            || payload.organizationId !== expected.organizationId
            || payload.redirectUri !== expected.redirectUri) {
            throw new Error('OAuth state mismatch');
        }
    }
    catch {
        throw new common_1.BadRequestException('Invalid OAuth state');
    }
}
//# sourceMappingURL=oauth-state.js.map