"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuscriptoresDeCorreo1756700000000 = void 0;
class SuscriptoresDeCorreo1756700000000 {
    constructor() {
        this.name = 'SuscriptoresDeCorreo1756700000000';
    }
    async up(queryRunner) {
        const tablas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'email_subscribers'
    `);
        if (Number(tablas?.[0]?.n ?? 0) > 0)
            return;
        await queryRunner.query(`
      CREATE TABLE email_subscribers (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        client_id CHAR(36) NULL,
        email VARCHAR(190) NOT NULL,
        name VARCHAR(180) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        source VARCHAR(120) NOT NULL,
        source_detail VARCHAR(255) NULL,
        consent_at TIMESTAMP NULL,
        consent_text TEXT NULL,
        consent_ip VARCHAR(45) NULL,
        unsubscribed_at TIMESTAMP NULL,
        unsubscribe_token VARCHAR(64) NOT NULL,
        last_sent_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        await queryRunner.query('ALTER TABLE email_subscribers ADD UNIQUE KEY UQ_email_subscribers_org_email (organization_id, email)');
        await queryRunner.query('ALTER TABLE email_subscribers ADD UNIQUE KEY UQ_email_subscribers_token (unsubscribe_token)');
        await queryRunner.query('CREATE INDEX IDX_email_subscribers_org_status ON email_subscribers (organization_id, status)');
    }
    async down(queryRunner) {
        await queryRunner.query('DROP TABLE IF EXISTS email_subscribers');
    }
}
exports.SuscriptoresDeCorreo1756700000000 = SuscriptoresDeCorreo1756700000000;
