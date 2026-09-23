"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampoPropioPorEmpresa1790000000152 = void 0;
const typeorm_1 = require("typeorm");
class CampoPropioPorEmpresa1790000000152 {
    constructor() {
        this.name = 'CampoPropioPorEmpresa1790000000152';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('crm_field_definitions')))
            return;
        const tabla = await queryRunner.getTable('crm_field_definitions');
        if (!tabla?.findColumnByName('client_id')) {
            await queryRunner.addColumn('crm_field_definitions', new typeorm_1.TableColumn({ name: 'client_id', type: 'varchar', length: '36', isNullable: true }));
        }
        if (!tabla?.findColumnByName('client_scope')) {
            await queryRunner.query('ALTER TABLE crm_field_definitions ADD COLUMN client_scope VARCHAR(36) AS (COALESCE(client_id, \'*\')) STORED');
        }
        const indices = (await queryRunner.getTable('crm_field_definitions'))?.indices ?? [];
        if (indices.some((indice) => indice.name === 'UQ_crm_field_org_entity_key')) {
            await queryRunner.query('DROP INDEX UQ_crm_field_org_entity_key ON crm_field_definitions');
        }
        if (!indices.some((indice) => indice.name === 'UQ_crm_field_org_entity_key_client')) {
            await queryRunner.query('CREATE UNIQUE INDEX UQ_crm_field_org_entity_key_client ON crm_field_definitions (organization_id, entity, field_key, client_scope)');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('crm_field_definitions')))
            return;
        const tabla = await queryRunner.getTable('crm_field_definitions');
        const indices = tabla?.indices ?? [];
        if (indices.some((indice) => indice.name === 'UQ_crm_field_org_entity_key_client')) {
            await queryRunner.query('DROP INDEX UQ_crm_field_org_entity_key_client ON crm_field_definitions');
        }
        await queryRunner.query('DELETE FROM crm_field_definitions WHERE client_id IS NOT NULL');
        if (tabla?.findColumnByName('client_scope'))
            await queryRunner.query('ALTER TABLE crm_field_definitions DROP COLUMN client_scope');
        if (tabla?.findColumnByName('client_id'))
            await queryRunner.dropColumn('crm_field_definitions', 'client_id');
        await queryRunner.query('CREATE UNIQUE INDEX UQ_crm_field_org_entity_key ON crm_field_definitions (organization_id, entity, field_key)');
    }
}
exports.CampoPropioPorEmpresa1790000000152 = CampoPropioPorEmpresa1790000000152;
