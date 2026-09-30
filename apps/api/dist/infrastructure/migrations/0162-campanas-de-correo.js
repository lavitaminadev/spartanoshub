"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampanasDeCorreo1790000000162 = void 0;
class CampanasDeCorreo1790000000162 {
    constructor() {
        this.name = 'CampanasDeCorreo1790000000162';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('email_campaigns'))
            return;
        await queryRunner.query(`
      CREATE TABLE email_campaigns (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        client_id CHAR(36) NULL,
        asunto VARCHAR(200) NOT NULL,
        cuerpo TEXT NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'draft',
        destinatarios INT NOT NULL DEFAULT 0,
        enviados INT NOT NULL DEFAULT 0,
        sent_at TIMESTAMP NULL,
        created_by CHAR(36) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX IDX_email_campaigns_org_client (organization_id, client_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('email_campaigns')) {
            await queryRunner.query('DROP TABLE email_campaigns');
        }
    }
}
exports.CampanasDeCorreo1790000000162 = CampanasDeCorreo1790000000162;
