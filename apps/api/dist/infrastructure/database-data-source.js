"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataSourceOptions = void 0;
require("../config/load-environment");
const typeorm_1 = require("typeorm");
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USERNAME = process.env.DB_USERNAME || 'vitahub';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_DATABASE = process.env.DB_DATABASE || 'vitahub';
const DB_CONNECTION_LIMIT = Math.max(1, parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10) || 10);
exports.dataSourceOptions = {
    type: 'mysql',
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_DATABASE,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: process.env.DB_LOGGING === 'true',
    extra: {
        charset: 'utf8mb4_unicode_ci',
        connectionLimit: DB_CONNECTION_LIMIT,
        ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
    },
};
const dataSource = new typeorm_1.DataSource(exports.dataSourceOptions);
exports.default = dataSource;
//# sourceMappingURL=database-data-source.js.map