"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationContactLink1724164200000 = void 0;
const typeorm_1 = require("typeorm");
class ReservationContactLink1724164200000 {
    constructor() {
        this.name = 'ReservationContactLink1724164200000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasColumn('reservations', 'contact_id'))) {
            await queryRunner.addColumn('reservations', new typeorm_1.TableColumn({
                name: 'contact_id',
                type: 'char',
                length: '36',
                isNullable: true,
            }));
        }
        if (await queryRunner.hasTable('crm_leads')) {
            await queryRunner.query(`
        UPDATE reservations r
        INNER JOIN crm_leads l ON l.external_lead_id = CONCAT('reservation:', r.id)
        INNER JOIN crm_contacts c ON c.lead_id = l.id
        SET r.contact_id = c.id
        WHERE r.contact_id IS NULL
      `);
            await queryRunner.query(`
        UPDATE reservations r
        INNER JOIN crm_leads l
          ON l.client_id = r.client_id
         AND l.source = 'vitahub_reservations'
         AND (
               (l.phone IS NOT NULL AND r.guest_phone IS NOT NULL AND l.phone = r.guest_phone)
            OR (l.email IS NOT NULL AND r.guest_email IS NOT NULL AND l.email = r.guest_email)
             )
        INNER JOIN crm_contacts c ON c.lead_id = l.id
        SET r.contact_id = c.id
        WHERE r.contact_id IS NULL
      `);
        }
        const indexExists = await queryRunner.query(`SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'reservations' AND index_name = 'IDX_reservations_contact'`);
        if (Number(indexExists?.[0]?.total ?? 0) === 0) {
            await queryRunner.query('CREATE INDEX IDX_reservations_contact ON reservations (contact_id)');
        }
    }
    async down(queryRunner) {
        const indexExists = await queryRunner.query(`SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'reservations' AND index_name = 'IDX_reservations_contact'`);
        if (Number(indexExists?.[0]?.total ?? 0) > 0) {
            await queryRunner.query('DROP INDEX IDX_reservations_contact ON reservations');
        }
        if (await queryRunner.hasColumn('reservations', 'contact_id')) {
            await queryRunner.dropColumn('reservations', 'contact_id');
        }
    }
}
exports.ReservationContactLink1724164200000 = ReservationContactLink1724164200000;
//# sourceMappingURL=0066-reservation-contact-link.js.map