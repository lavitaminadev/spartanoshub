"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationLeadSourceRename1726900000000 = void 0;
class ReservationLeadSourceRename1726900000000 {
    constructor() {
        this.name = 'ReservationLeadSourceRename1726900000000';
    }
    async up(queryRunner) {
        await ReservationLeadSourceRename1726900000000.rewrite(queryRunner, ReservationLeadSourceRename1726900000000.PREVIOUS, ReservationLeadSourceRename1726900000000.CURRENT);
    }
    async down(queryRunner) {
        await ReservationLeadSourceRename1726900000000.rewrite(queryRunner, ReservationLeadSourceRename1726900000000.CURRENT, ReservationLeadSourceRename1726900000000.PREVIOUS);
    }
    static async rewrite(queryRunner, from, to) {
        for (const table of ['leads', 'contacts']) {
            if (!(await queryRunner.hasTable(table)))
                continue;
            if (!(await queryRunner.hasColumn(table, 'source')))
                continue;
            await queryRunner.query(`UPDATE ${table} SET source = ? WHERE source = ?`, [to, from]);
        }
    }
}
exports.ReservationLeadSourceRename1726900000000 = ReservationLeadSourceRename1726900000000;
ReservationLeadSourceRename1726900000000.PREVIOUS = 'vitahub_reservations';
ReservationLeadSourceRename1726900000000.CURRENT = 'espartanos_reservations';
//# sourceMappingURL=0079-reservation-lead-source-rename.js.map