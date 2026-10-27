"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistroDeVulneraciones1790000000185 = void 0;
class RegistroDeVulneraciones1790000000185 {
    constructor() {
        this.name = 'RegistroDeVulneraciones1790000000185';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('security_incidents'))
            return;
        await queryRunner.query(`
      CREATE TABLE security_incidents (
        id VARCHAR(36) NOT NULL,
        organization_id VARCHAR(36) NOT NULL,
        descripcion TEXT NOT NULL,
        detected_at DATETIME NOT NULL,
        datos_afectados TEXT NOT NULL,
        titulares_afectados INT NULL,
        client_ids JSON NOT NULL,
        medidas TEXT NULL,
        aviso_local_at DATETIME NULL,
        aviso_agencia_at DATETIME NULL,
        created_by VARCHAR(36) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        INDEX IDX_security_incidents_org_detected (organization_id, detected_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('security_incidents'))
            await queryRunner.query('DROP TABLE security_incidents');
    }
}
exports.RegistroDeVulneraciones1790000000185 = RegistroDeVulneraciones1790000000185;
