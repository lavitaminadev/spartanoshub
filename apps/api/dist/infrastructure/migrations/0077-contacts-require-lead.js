"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactsRequireLead1726200000000 = void 0;
const typeorm_1 = require("typeorm");
class ContactsRequireLead1726200000000 {
    constructor() {
        this.name = 'ContactsRequireLead1726200000000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('crm_contacts')))
            return;
        await queryRunner.query(`
      INSERT INTO leads (id, organization_id, client_id, name, email, phone, domain, source, status, fit_status, quality_score, created_at, updated_at)
      SELECT UUID(), c.organization_id, c.client_id, c.name, c.email, c.phone,
             CASE WHEN c.client_id IS NULL THEN 'commercial' ELSE 'audience' END,
             'contacto_migrado', 'new', 'review', 0, c.created_at, c.updated_at
      FROM crm_contacts c
      WHERE c.lead_id IS NULL
    `);
        await queryRunner.query(`
      UPDATE crm_contacts c
      JOIN leads l
        ON l.organization_id = c.organization_id
       AND l.source = 'contacto_migrado'
       AND l.name = c.name
       AND (l.email <=> c.email)
       AND (l.phone <=> c.phone)
      SET c.lead_id = l.id
      WHERE c.lead_id IS NULL
    `);
        const [{ orphans }] = await queryRunner.query(`SELECT COUNT(*) AS orphans FROM crm_contacts WHERE lead_id IS NULL`);
        if (Number(orphans) > 0) {
            throw new Error(`Quedan ${orphans} contactos sin lead: revisarlos a mano antes de continuar`);
        }
        const previousForeignKey = await this.findLeadForeignKey(queryRunner);
        if (previousForeignKey)
            await queryRunner.dropForeignKey('crm_contacts', previousForeignKey);
        try {
            await queryRunner.query(`ALTER TABLE crm_contacts MODIFY lead_id VARCHAR(36) NOT NULL`);
            await queryRunner.createForeignKey('crm_contacts', this.leadForeignKey(previousForeignKey, 'RESTRICT'));
        }
        catch (error) {
            await queryRunner.query(`ALTER TABLE crm_contacts MODIFY lead_id VARCHAR(36) NULL`);
            if (previousForeignKey)
                await queryRunner.createForeignKey('crm_contacts', previousForeignKey);
            throw error;
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('crm_contacts')))
            return;
        const requiredForeignKey = await this.findLeadForeignKey(queryRunner);
        if (requiredForeignKey)
            await queryRunner.dropForeignKey('crm_contacts', requiredForeignKey);
        try {
            await queryRunner.query(`ALTER TABLE crm_contacts MODIFY lead_id VARCHAR(36) NULL`);
            await queryRunner.createForeignKey('crm_contacts', this.leadForeignKey(requiredForeignKey, 'SET NULL'));
        }
        catch (error) {
            await queryRunner.query(`ALTER TABLE crm_contacts MODIFY lead_id VARCHAR(36) NOT NULL`);
            if (requiredForeignKey)
                await queryRunner.createForeignKey('crm_contacts', requiredForeignKey);
            throw error;
        }
    }
    async findLeadForeignKey(queryRunner) {
        const table = await queryRunner.getTable('crm_contacts');
        return table?.foreignKeys.find((foreignKey) => foreignKey.columnNames.length === 1
            && foreignKey.columnNames[0] === 'lead_id'
            && foreignKey.referencedTableName.split('.').pop() === 'leads');
    }
    leadForeignKey(previous, onDelete) {
        return new typeorm_1.TableForeignKey({
            name: previous?.name || 'FK_crm_contacts_lead',
            columnNames: ['lead_id'],
            referencedTableName: 'leads',
            referencedColumnNames: ['id'],
            onDelete,
            onUpdate: previous?.onUpdate,
        });
    }
}
exports.ContactsRequireLead1726200000000 = ContactsRequireLead1726200000000;
//# sourceMappingURL=0077-contacts-require-lead.js.map