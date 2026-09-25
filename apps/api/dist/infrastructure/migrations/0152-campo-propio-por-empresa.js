"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampoPropioPorEmpresa1790000000152 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class CampoPropioPorEmpresa1790000000152 {
    constructor() {
        this.name = 'CampoPropioPorEmpresa1790000000152';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('crm_field_definitions')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'crm_field_definitions', 'client_id'))) {
            await queryRunner.query('ALTER TABLE crm_field_definitions ADD COLUMN client_id VARCHAR(36) NULL');
        }
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'crm_field_definitions', 'client_scope'))) {
            await queryRunner.query('ALTER TABLE crm_field_definitions ADD COLUMN client_scope VARCHAR(36) AS (COALESCE(client_id, \'*\')) STORED');
        }
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'crm_field_definitions', 'UQ_crm_field_org_entity_key_client'))) {
            await queryRunner.query('CREATE UNIQUE INDEX UQ_crm_field_org_entity_key_client ON crm_field_definitions (organization_id, entity, field_key, client_scope)');
        }
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'crm_field_definitions', 'UQ_crm_field_org_entity_key')) {
            await queryRunner.query('DROP INDEX UQ_crm_field_org_entity_key ON crm_field_definitions');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('crm_field_definitions')))
            return;
        await queryRunner.query('DELETE FROM crm_field_definitions WHERE client_id IS NOT NULL');
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'crm_field_definitions', 'UQ_crm_field_org_entity_key'))) {
            await queryRunner.query('CREATE UNIQUE INDEX UQ_crm_field_org_entity_key ON crm_field_definitions (organization_id, entity, field_key)');
        }
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'crm_field_definitions', 'UQ_crm_field_org_entity_key_client')) {
            await queryRunner.query('DROP INDEX UQ_crm_field_org_entity_key_client ON crm_field_definitions');
        }
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'crm_field_definitions', 'client_scope')) {
            await queryRunner.query('ALTER TABLE crm_field_definitions DROP COLUMN client_scope');
        }
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'crm_field_definitions', 'client_id')) {
            await queryRunner.query('ALTER TABLE crm_field_definitions DROP COLUMN client_id');
        }
    }
}
exports.CampoPropioPorEmpresa1790000000152 = CampoPropioPorEmpresa1790000000152;
