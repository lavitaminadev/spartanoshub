"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PixelsEnTabla1757200000000 = void 0;
const node_crypto_1 = require("node:crypto");
class PixelsEnTabla1757200000000 {
    constructor() {
        this.name = 'PixelsEnTabla1757200000000';
    }
    async up(queryRunner) {
        const tablas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'meta_pixels'
    `);
        if (Number(tablas?.[0]?.n ?? 0) > 0)
            return;
        await queryRunner.query(`
      CREATE TABLE meta_pixels (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        client_id CHAR(36) NULL,
        pixel_id VARCHAR(64) NOT NULL,
        name VARCHAR(255) NULL,
        access_token TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        await queryRunner.query('ALTER TABLE meta_pixels ADD UNIQUE KEY UQ_meta_pixels_scope (organization_id, client_id, pixel_id)');
        await queryRunner.query('CREATE INDEX IDX_meta_pixels_org_pixel ON meta_pixels (organization_id, pixel_id)');
        await this.copiarDesdeElJson(queryRunner);
    }
    async copiarDesdeElJson(queryRunner) {
        const integraciones = await queryRunner.query("SELECT organization_id, config FROM integrations WHERE provider = 'meta' AND config IS NOT NULL");
        for (const fila of integraciones) {
            const config = typeof fila.config === 'string' ? JSON.parse(fila.config) : fila.config;
            if (!config || typeof config !== 'object')
                continue;
            for (const [pixelId, credencial] of Object.entries(config.metaPixels ?? {})) {
                const datos = credencial;
                await queryRunner.query('INSERT INTO meta_pixels (id, organization_id, client_id, pixel_id, name, access_token) VALUES (?, ?, NULL, ?, ?, ?)', [(0, node_crypto_1.randomUUID)(), fila.organization_id, pixelId, datos?.name ?? null, datos?.accessToken ?? null]);
            }
            for (const [clientId, registro] of Object.entries(config.clientPixels ?? {})) {
                const datos = registro;
                if (!datos?.pixelId)
                    continue;
                await queryRunner.query('INSERT INTO meta_pixels (id, organization_id, client_id, pixel_id, name, access_token) VALUES (?, ?, ?, ?, ?, ?)', [(0, node_crypto_1.randomUUID)(), fila.organization_id, clientId, datos.pixelId, datos.pixelName ?? null, datos.accessToken ?? null]);
            }
        }
    }
    async down(queryRunner) {
        await queryRunner.query('DROP TABLE IF EXISTS meta_pixels');
    }
}
exports.PixelsEnTabla1757200000000 = PixelsEnTabla1757200000000;
