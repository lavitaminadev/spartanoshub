"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CamposPersonalizadosCrm1758900000000 = void 0;
class CamposPersonalizadosCrm1758900000000 {
    constructor() {
        this.name = 'CamposPersonalizadosCrm1758900000000';
    }
    async existe(queryRunner, tabla, columna) {
        const rows = await queryRunner.query('SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?', [tabla, columna]);
        return Number(rows?.[0]?.n ?? 0) > 0;
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('crm_field_definitions'))) {
            await queryRunner.query(`
        CREATE TABLE crm_field_definitions (
          id uuid NOT NULL,
          organization_id uuid NOT NULL,
          entity varchar(20) NOT NULL,
          field_key varchar(40) NOT NULL,
          label varchar(80) NOT NULL,
          type varchar(20) NOT NULL,
          options json NULL,
          required tinyint(1) NOT NULL DEFAULT 0,
          position int NOT NULL DEFAULT 0,
          archived_at timestamp NULL,
          created_by uuid NULL,
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY UQ_crm_field_org_entity_key (organization_id, entity, field_key),
          KEY IDX_crm_field_org_entity (organization_id, entity, archived_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
        }
        for (const tabla of CamposPersonalizadosCrm1758900000000.TABLAS) {
            if (await this.existe(queryRunner, tabla, 'custom_fields'))
                continue;
            await queryRunner.query(`ALTER TABLE ${tabla} ADD COLUMN custom_fields json NULL`);
        }
    }
    async down(queryRunner) {
        for (const tabla of CamposPersonalizadosCrm1758900000000.TABLAS) {
            if (!(await this.existe(queryRunner, tabla, 'custom_fields')))
                continue;
            await queryRunner.query(`ALTER TABLE ${tabla} DROP COLUMN custom_fields`);
        }
        if (await queryRunner.hasTable('crm_field_definitions'))
            await queryRunner.query('DROP TABLE crm_field_definitions');
    }
}
exports.CamposPersonalizadosCrm1758900000000 = CamposPersonalizadosCrm1758900000000;
CamposPersonalizadosCrm1758900000000.TABLAS = ['leads', 'crm_contacts', 'crm_opportunities'];
