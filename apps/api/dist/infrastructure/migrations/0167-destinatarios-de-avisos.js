"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DestinatariosDeAvisos1790000000167 = void 0;
class DestinatariosDeAvisos1790000000167 {
    constructor() {
        this.name = 'DestinatariosDeAvisos1790000000167';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('team_notification_recipients'))
            return;
        await queryRunner.query(`
      CREATE TABLE team_notification_recipients (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        client_id CHAR(36) NOT NULL,
        email VARCHAR(190) NOT NULL,
        name VARCHAR(120) NULL,
        cargo VARCHAR(80) NULL,
        tipos JSON NULL,
        created_by CHAR(36) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY UQ_team_recipients_org_client_email (organization_id, client_id, email),
        KEY IDX_team_recipients_org_client (organization_id, client_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('team_notification_recipients')) {
            await queryRunner.query('DROP TABLE team_notification_recipients');
        }
    }
}
exports.DestinatariosDeAvisos1790000000167 = DestinatariosDeAvisos1790000000167;
