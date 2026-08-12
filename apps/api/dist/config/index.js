"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const node_crypto_1 = require("node:crypto");
const developmentJwtSecret = (0, node_crypto_1.randomBytes)(32).toString('hex');
exports.config = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        username: process.env.DB_USERNAME || 'espartanos',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'espartanos',
    },
    jwt: {
        secret: process.env.JWT_SECRET || developmentJwtSecret,
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    bcrypt: {
        rounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
    },
    throttle: {
        ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
    },
};
