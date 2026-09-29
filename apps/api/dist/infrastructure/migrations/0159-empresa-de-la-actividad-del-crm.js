"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmpresaDeLaActividadDelCrm1790000000159 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class EmpresaDeLaActividadDelCrm1790000000159 {
    constructor() {
        this.name = 'EmpresaDeLaActividadDelCrm1790000000159';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('crm_interactions')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'crm_interactions', 'client_id'))) {
            await queryRunner.query('ALTER TABLE crm_interactions ADD COLUMN client_id CHAR(36) NULL');
        }
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'crm_interactions', 'IDX_crm_interactions_org_client'))) {
            await queryRunner.query('CREATE INDEX IDX_crm_interactions_org_client ON crm_interactions (organization_id, client_id)');
        }
        if (await queryRunner.hasTable('leads')) {
            await queryRunner.query(`
        UPDATE crm_interactions i
        JOIN leads l ON l.id = i.lead_id AND l.organization_id = i.organization_id
        SET i.client_id = l.client_id
        WHERE i.client_id IS NULL AND l.client_id IS NOT NULL
      `);
        }
        if (await queryRunner.hasTable('crm_contacts')) {
            await queryRunner.query(`
        UPDATE crm_interactions i
        JOIN crm_contacts c ON c.id = i.contact_id AND c.organization_id = i.organization_id
        SET i.client_id = c.client_id
        WHERE i.client_id IS NULL AND c.client_id IS NOT NULL
      `);
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('crm_interactions')))
            return;
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'crm_interactions', 'IDX_crm_interactions_org_client')) {
            await queryRunner.query('DROP INDEX IDX_crm_interactions_org_client ON crm_interactions');
        }
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'crm_interactions', 'client_id')) {
            await queryRunner.query('ALTER TABLE crm_interactions DROP COLUMN client_id');
        }
    }
}
exports.EmpresaDeLaActividadDelCrm1790000000159 = EmpresaDeLaActividadDelCrm1790000000159;
