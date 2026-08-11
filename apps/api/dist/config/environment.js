"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnvironment = validateEnvironment;
exports.parseCorsOrigins = parseCorsOrigins;
const zod_1 = require("zod");
const environmentSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(3000),
    CORS_ORIGIN: zod_1.z.string().min(1).default('http://localhost:5173'),
    DB_HOST: zod_1.z.string().min(1).default('localhost'),
    DB_PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(3306),
    DB_USERNAME: zod_1.z.string().min(1).default('vitahub'),
    DB_PASSWORD: zod_1.z.string().min(1),
    DB_DATABASE: zod_1.z.string().min(1).default('vitahub'),
    DB_SSL: zod_1.z.enum(['true', 'false']).default('false'),
    DB_CONNECTION_LIMIT: zod_1.z.coerce.number().int().min(1).max(50).default(10),
    JWT_SECRET: zod_1.z.string().min(32),
    JWT_EXPIRES_IN: zod_1.z.string().regex(/^\d+[smhd]$/).default('15m'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().regex(/^\d+[smhd]$/).default('7d'),
    INTEGRATION_ENCRYPTION_KEY: zod_1.z.string().min(32),
    OAUTH_STATE_SECRET: zod_1.z.string().min(32),
    CRON_SECRET: zod_1.z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/),
    BCRYPT_ROUNDS: zod_1.z.coerce.number().int().min(10).max(14).default(12),
    APP_PUBLIC_URL: zod_1.z.string().url(),
    API_PUBLIC_URL: zod_1.z.string().url(),
    VITE_API_URL: zod_1.z.string().url(),
    UPLOAD_DIR: zod_1.z.string().min(1),
    CONVERSATION_SERVICE_URL: zod_1.z.preprocess((value) => value === '' ? undefined : value, zod_1.z.string().url().optional()),
    INTERNAL_API_TOKEN: zod_1.z.string().min(32).optional(),
    MAX_UPLOAD_BYTES: zod_1.z.coerce.number().int().min(1024).max(100 * 1024 * 1024).default(20 * 1024 * 1024),
    CLOUDINARY_CLOUD_NAME: zod_1.z.string().min(1).optional(),
    CLOUDINARY_API_KEY: zod_1.z.string().min(1).optional(),
    CLOUDINARY_API_SECRET: zod_1.z.string().min(1).optional(),
    CLOUDINARY_MAX_IMAGE_BYTES: zod_1.z.coerce.number().int().min(1024).max(10 * 1024 * 1024).default(5 * 1024 * 1024),
    TRUST_PROXY_HOPS: zod_1.z.coerce.number().int().min(0).max(10).default(1),
    SMTP_ENABLED: zod_1.z.enum(['true', 'false']).default('false'),
    SMTP_HOST: zod_1.z.string().min(1).optional(),
    SMTP_PORT: zod_1.z.coerce.number().int().min(1).max(65535).optional(),
    SMTP_SECURE: zod_1.z.enum(['true', 'false']).optional(),
    SMTP_USER: zod_1.z.string().min(1).optional(),
    SMTP_PASSWORD: zod_1.z.string().min(1).optional(),
    SMTP_FROM: zod_1.z.string().email().optional(),
    SMTP_REPLY_TO: zod_1.z.string().email().optional(),
});
function validateEnvironment(environment = process.env) {
    if (environment.NODE_ENV !== 'production')
        return;
    const result = environmentSchema.safeParse(environment);
    if (!result.success) {
        const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
        throw new Error(`Invalid production environment: ${fields}`);
    }
    const forbidden = ['vitahub_secret', 'change_me', 'change_this', 'generate_', 'replace_with', 'your_'];
    for (const key of ['DB_PASSWORD', 'JWT_SECRET', 'INTEGRATION_ENCRYPTION_KEY', 'OAUTH_STATE_SECRET', 'CRON_SECRET']) {
        if (forbidden.some((value) => environment[key]?.includes(value)))
            throw new Error(`Unsafe production secret: ${key}`);
    }
    const encryptionKey = environment.INTEGRATION_ENCRYPTION_KEY.trim();
    const encryptionBytes = /^[0-9a-f]{64}$/i.test(encryptionKey)
        ? Buffer.from(encryptionKey, 'hex')
        : Buffer.from(encryptionKey, 'base64');
    const validBase64 = encryptionBytes.toString('base64') === encryptionKey;
    if (encryptionBytes.length !== 32 || (!/^[0-9a-f]{64}$/i.test(encryptionKey) && !validBase64)) {
        throw new Error('INTEGRATION_ENCRYPTION_KEY must contain exactly 32 bytes (base64 or hex)');
    }
    for (const key of ['APP_PUBLIC_URL', 'API_PUBLIC_URL', 'VITE_API_URL']) {
        const url = new URL(environment[key]);
        if (url.protocol !== 'https:' || url.username || url.password)
            throw new Error(`Unsafe production URL: ${key}`);
    }
    const appUrl = new URL(environment.APP_PUBLIC_URL);
    const apiUrl = new URL(environment.API_PUBLIC_URL);
    const viteApiUrl = new URL(environment.VITE_API_URL);
    if (appUrl.origin !== 'https://cuartel.espartanos.cl')
        throw new Error('APP_PUBLIC_URL must use https://cuartel.espartanos.cl');
    if (apiUrl.origin !== 'https://refugio.espartanos.cl')
        throw new Error('API_PUBLIC_URL must use https://refugio.espartanos.cl/api');
    if (appUrl.pathname !== '/' || appUrl.search || appUrl.hash)
        throw new Error('APP_PUBLIC_URL must be an origin without a path');
    if (apiUrl.pathname.replace(/\/$/, '') !== '/api' || apiUrl.search || apiUrl.hash)
        throw new Error('API_PUBLIC_URL must end in /api');
    if (viteApiUrl.href.replace(/\/$/, '') !== apiUrl.href.replace(/\/$/, ''))
        throw new Error('VITE_API_URL must match API_PUBLIC_URL');
    const origins = parseCorsOrigins(environment.CORS_ORIGIN);
    if (!origins.length || origins.includes('*'))
        throw new Error('Unsafe production CORS_ORIGIN');
    for (const origin of origins) {
        const url = new URL(origin);
        if (url.protocol !== 'https:' || url.origin !== origin)
            throw new Error('Unsafe production CORS_ORIGIN');
    }
    if (origins.length !== 1 || origins[0] !== appUrl.origin)
        throw new Error('CORS_ORIGIN must contain only APP_PUBLIC_URL');
    const uploadDir = environment.UPLOAD_DIR.replace(/\\/g, '/');
    if (!/^(?:\/|[A-Za-z]:\/)/.test(uploadDir) || /(^|\/)public_html(\/|$)/i.test(uploadDir)) {
        throw new Error('UPLOAD_DIR must be absolute and outside public_html');
    }
    if (environment.CONVERSATION_SERVICE_URL) {
        const serviceUrl = new URL(environment.CONVERSATION_SERVICE_URL);
        if (serviceUrl.protocol !== 'https:' || !environment.INTERNAL_API_TOKEN || environment.INTERNAL_API_TOKEN.length < 32) {
            throw new Error('Unsafe production conversation service configuration');
        }
    }
    if (environment.SMTP_ENABLED === 'true') {
        const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];
        if (required.some((key) => !environment[key]?.trim()))
            throw new Error('Invalid production SMTP configuration');
    }
}
function parseCorsOrigins(value = process.env.CORS_ORIGIN ?? 'http://localhost:5173') {
    return value.split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean);
}
//# sourceMappingURL=environment.js.map