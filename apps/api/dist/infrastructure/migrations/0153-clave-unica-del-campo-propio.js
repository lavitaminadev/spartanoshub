"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaveUnicaDelCampoPropio1790000000153 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class ClaveUnicaDelCampoPropio1790000000153 {
    constructor() {
        this.name = 'ClaveUnicaDelCampoPropio1790000000153';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('crm_field_definitions')))
            return;
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'crm_field_definitions', 'UQ_crm_field_org_entity_key_client'))) {
            await queryRunner.query('CREATE UNIQUE INDEX UQ_crm_field_org_entity_key_client ON crm_field_definitions (organization_id, entity, field_key, client_scope)');
        }
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'crm_field_definitions', 'UQ_crm_field_org_entity_key')) {
            await queryRunner.query('DROP INDEX UQ_crm_field_org_entity_key ON crm_field_definitions');
        }
    }
    async down() {
    }
}
exports.ClaveUnicaDelCampoPropio1790000000153 = ClaveUnicaDelCampoPropio1790000000153;
