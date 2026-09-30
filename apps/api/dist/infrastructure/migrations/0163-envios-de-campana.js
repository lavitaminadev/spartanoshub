"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnviosDeCampana1790000000163 = void 0;
class EnviosDeCampana1790000000163 {
    constructor() {
        this.name = 'EnviosDeCampana1790000000163';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('email_campaign_sends'))
            return;
        await queryRunner.query(`
      CREATE TABLE email_campaign_sends (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        campana_id CHAR(36) NOT NULL,
        suscriptor_id CHAR(36) NOT NULL,
        email VARCHAR(190) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        next_attempt_at TIMESTAMP NULL,
        last_error TEXT NULL,
        processed_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX IDX_email_campaign_sends_status (status, next_attempt_at),
        INDEX IDX_email_campaign_sends_campana (campana_id, status),
        UNIQUE INDEX UQ_email_campaign_sends_campana_suscriptor (campana_id, suscriptor_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('email_campaign_sends')) {
            await queryRunner.query('DROP TABLE email_campaign_sends');
        }
    }
}
exports.EnviosDeCampana1790000000163 = EnviosDeCampana1790000000163;
