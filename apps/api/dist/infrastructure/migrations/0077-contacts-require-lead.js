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
        const { contactLeadColumn, referencedLeadColumn, foreignKey: previousForeignKey, } = await this.getLeadSchema(queryRunner);
        if (previousForeignKey)
            await queryRunner.dropForeignKey('crm_contacts', previousForeignKey);
        const requiredColumn = this.compatibleLeadColumn(contactLeadColumn, referencedLeadColumn, false);
        const nullableColumn = this.compatibleLeadColumn(contactLeadColumn, referencedLeadColumn, true);
        let columnChanged = false;
        try {
            await queryRunner.changeColumn('crm_contacts', contactLeadColumn, requiredColumn);
            columnChanged = true;
            await queryRunner.createForeignKey('crm_contacts', this.leadForeignKey(previousForeignKey, 'RESTRICT'));
        }
        catch (error) {
            if (columnChanged) {
                await queryRunner.changeColumn('crm_contacts', requiredColumn, nullableColumn);
            }
            await queryRunner.createForeignKey('crm_contacts', previousForeignKey || this.leadForeignKey(undefined, 'SET NULL'));
            throw error;
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('crm_contacts')))
            return;
        const { contactLeadColumn, referencedLeadColumn, foreignKey: requiredForeignKey, } = await this.getLeadSchema(queryRunner);
        if (requiredForeignKey)
            await queryRunner.dropForeignKey('crm_contacts', requiredForeignKey);
        const nullableColumn = this.compatibleLeadColumn(contactLeadColumn, referencedLeadColumn, true);
        const requiredColumn = this.compatibleLeadColumn(contactLeadColumn, referencedLeadColumn, false);
        let columnChanged = false;
        try {
            await queryRunner.changeColumn('crm_contacts', contactLeadColumn, nullableColumn);
            columnChanged = true;
            await queryRunner.createForeignKey('crm_contacts', this.leadForeignKey(requiredForeignKey, 'SET NULL'));
        }
        catch (error) {
            if (columnChanged) {
                await queryRunner.changeColumn('crm_contacts', nullableColumn, requiredColumn);
            }
            await queryRunner.createForeignKey('crm_contacts', requiredForeignKey || this.leadForeignKey(undefined, 'RESTRICT'));
            throw error;
        }
    }
    async getLeadSchema(queryRunner) {
        const [contactsTable, leadsTable] = await Promise.all([
            queryRunner.getTable('crm_contacts'),
            queryRunner.getTable('leads'),
        ]);
        const contactLeadColumn = contactsTable?.findColumnByName('lead_id');
        const referencedLeadColumn = leadsTable?.findColumnByName('id');
        if (!contactLeadColumn || !referencedLeadColumn) {
            throw new Error('No se pudo leer crm_contacts.lead_id o leads.id para validar su compatibilidad');
        }
        const foreignKey = contactsTable?.foreignKeys.find((candidate) => candidate.columnNames.length === 1
            && candidate.columnNames[0] === 'lead_id'
            && candidate.referencedTableName.split('.').pop() === 'leads');
        return { contactLeadColumn, referencedLeadColumn, foreignKey };
    }
    compatibleLeadColumn(current, referenced, isNullable) {
        const compatible = current.clone();
        compatible.type = referenced.type;
        compatible.length = referenced.length;
        compatible.width = referenced.width;
        compatible.charset = referenced.charset;
        compatible.collation = referenced.collation;
        compatible.precision = referenced.precision;
        compatible.scale = referenced.scale;
        compatible.zerofill = referenced.zerofill;
        compatible.unsigned = referenced.unsigned;
        compatible.enum = referenced.enum ? [...referenced.enum] : undefined;
        compatible.enumName = referenced.enumName;
        compatible.spatialFeatureType = referenced.spatialFeatureType;
        compatible.srid = referenced.srid;
        compatible.isNullable = isNullable;
        return compatible;
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