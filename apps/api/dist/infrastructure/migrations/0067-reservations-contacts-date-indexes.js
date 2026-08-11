"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationsContactsDateIndexes1724250000000 = void 0;
class ReservationsContactsDateIndexes1724250000000 {
    constructor() {
        this.name = 'ReservationsContactsDateIndexes1724250000000';
    }
    async createIndexIfMissing(queryRunner, table, indexName, definition) {
        const existing = await queryRunner.query(`SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`, [table, indexName]);
        if (Number(existing?.[0]?.total ?? 0) === 0) {
            await queryRunner.query(`CREATE INDEX ${indexName} ON ${table} (${definition})`);
        }
    }
    async dropIndexIfExists(queryRunner, table, indexName) {
        const existing = await queryRunner.query(`SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`, [table, indexName]);
        if (Number(existing?.[0]?.total ?? 0) > 0) {
            await queryRunner.query(`DROP INDEX ${indexName} ON ${table}`);
        }
    }
    async up(queryRunner) {
        await this.createIndexIfMissing(queryRunner, 'reservations', 'IDX_reservations_org_client_starts', 'organization_id, client_id, starts_at');
        if (await queryRunner.hasTable('crm_contacts')) {
            await this.createIndexIfMissing(queryRunner, 'crm_contacts', 'IDX_crm_contacts_org_client_created', 'organization_id, client_id, created_at');
        }
    }
    async down(queryRunner) {
        await this.dropIndexIfExists(queryRunner, 'crm_contacts', 'IDX_crm_contacts_org_client_created');
        await this.dropIndexIfExists(queryRunner, 'reservations', 'IDX_reservations_org_client_starts');
    }
}
exports.ReservationsContactsDateIndexes1724250000000 = ReservationsContactsDateIndexes1724250000000;
//# sourceMappingURL=0067-reservations-contacts-date-indexes.js.map