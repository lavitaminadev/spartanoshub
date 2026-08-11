"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMetaSignedRequest = parseMetaSignedRequest;
exports.createDeletionConfirmation = createDeletionConfirmation;
exports.verifyDeletionConfirmation = verifyDeletionConfirmation;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
function parseMetaSignedRequest(signedRequest, appSecret) {
    const [encodedSignature, encodedPayload, ...extra] = signedRequest.split('.');
    if (!encodedSignature || !encodedPayload || extra.length > 0) {
        throw new common_1.UnauthorizedException('Invalid Meta signed request');
    }
    const expected = (0, node_crypto_1.createHmac)('sha256', appSecret).update(encodedPayload).digest();
    const received = Buffer.from(encodedSignature, 'base64url');
    if (expected.length !== received.length || !(0, node_crypto_1.timingSafeEqual)(expected, received)) {
        throw new common_1.UnauthorizedException('Invalid Meta signed request');
    }
    try {
        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
        if (payload.algorithm?.toUpperCase() !== 'HMAC-SHA256' || !payload.user_id) {
            throw new Error('Invalid payload');
        }
        return payload;
    }
    catch {
        throw new common_1.UnauthorizedException('Invalid Meta signed request');
    }
}
function createDeletionConfirmation(userId, appSecret) {
    const payload = { userId, completedAt: new Date().toISOString() };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = (0, node_crypto_1.createHmac)('sha256', appSecret).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
}
function verifyDeletionConfirmation(code, appSecret) {
    const [encoded, signature, ...extra] = code.split('.');
    if (!encoded || !signature || extra.length)
        throw new common_1.UnauthorizedException('Invalid deletion confirmation');
    const expected = (0, node_crypto_1.createHmac)('sha256', appSecret).update(encoded).digest();
    const received = Buffer.from(signature, 'base64url');
    if (expected.length !== received.length || !(0, node_crypto_1.timingSafeEqual)(expected, received)) {
        throw new common_1.UnauthorizedException('Invalid deletion confirmation');
    }
    try {
        const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        if (!payload.userId || !payload.completedAt || Number.isNaN(Date.parse(payload.completedAt)))
            throw new Error('Invalid payload');
        return payload;
    }
    catch {
        throw new common_1.UnauthorizedException('Invalid deletion confirmation');
    }
}
//# sourceMappingURL=meta-data-deletion.js.map