"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactClientScope1724164100000 = void 0;
const typeorm_1 = require("typeorm");
class ContactClientScope1724164100000 {
    constructor() {
        this.name = 'ContactClientScope1724164100000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasColumn('crm_contacts', 'client_id'))) {
            await queryRunner.addColumn('crm_contacts', new typeorm_1.TableColumn({
                name: 'client_id',
                type: 'char',
                length: '36',
                isNullable: true,
            }));
        }
        if (await queryRunner.hasTable('crm_leads')) {
            await queryRunner.query(`
        UPDATE crm_contacts c
        INNER JOIN crm_leads l ON l.id = c.lead_id
        SET c.client_id = l.client_id
        WHERE c.client_id IS NULL AND l.client_id IS NOT NULL
      `);
        }
        const indexExists = await queryRunner.query(`SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'crm_contacts' AND index_name = 'idx_crm_contacts_org_client'`);
        if (Number(indexExists?.[0]?.total ?? 0) === 0) {
            await queryRunner.query('CREATE INDEX idx_crm_contacts_org_client ON crm_contacts (organization_id, client_id)');
        }
    }
    async down(queryRunner) {
        const indexExists = await queryRunner.query(`SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'crm_contacts' AND index_name = 'idx_crm_contacts_org_client'`);
        if (Number(indexExists?.[0]?.total ?? 0) > 0) {
            await queryRunner.query('DROP INDEX idx_crm_contacts_org_client ON crm_contacts');
        }
        if (await queryRunner.hasColumn('crm_contacts', 'client_id')) {
            await queryRunner.dropColumn('crm_contacts', 'client_id');
        }
    }
}
exports.ContactClientScope1724164100000 = ContactClientScope1724164100000;
