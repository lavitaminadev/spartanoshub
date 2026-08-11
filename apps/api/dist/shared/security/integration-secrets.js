"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.protectSecret = protectSecret;
exports.revealSecret = revealSecret;
const node_crypto_1 = require("node:crypto");
const PREFIX = 'enc:v1';
function encryptionKey() {
    const configured = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
    if (configured) {
        const decoded = /^[0-9a-f]{64}$/i.test(configured)
            ? Buffer.from(configured, 'hex')
            : Buffer.from(configured, 'base64');
        if (decoded.length !== 32) {
            throw new Error('INTEGRATION_ENCRYPTION_KEY must contain exactly 32 bytes (base64 or hex)');
        }
        return decoded;
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('INTEGRATION_ENCRYPTION_KEY is required in production');
    }
    return (0, node_crypto_1.createHash)('sha256')
        .update(process.env.JWT_SECRET || 'vitahub-local-integration-key')
        .digest();
}
function protectSecret(value) {
    if (!value || value.startsWith(`${PREFIX}:`))
        return value;
    const iv = (0, node_crypto_1.randomBytes)(12);
    const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
}
function revealSecret(value) {
    if (!value)
        return undefined;
    if (!value.startsWith(`${PREFIX}:`))
        return value;
    const parts = value.split(':');
    if (parts.length !== 5)
        throw new Error('Encrypted integration secret has an invalid format');
    const [, , ivValue, tagValue, ciphertextValue] = parts;
    const decipher = (0, node_crypto_1.createDecipheriv)('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(ciphertextValue, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
}
//# sourceMappingURL=integration-secrets.js.map