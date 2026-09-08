"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationGroupRequestDetails1758400000000 = void 0;
class ReservationGroupRequestDetails1758400000000 {
    constructor() {
        this.name = 'ReservationGroupRequestDetails1758400000000';
    }
    async up(queryRunner) {
        const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reservation_group_requests' AND column_name = 'details'");
        if (Number(rows?.[0]?.n ?? 0) === 0)
            await queryRunner.query('ALTER TABLE reservation_group_requests ADD COLUMN details JSON NULL');
    }
    async down(queryRunner) {
        const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reservation_group_requests' AND column_name = 'details'");
        if (Number(rows?.[0]?.n ?? 0) > 0)
            await queryRunner.query('ALTER TABLE reservation_group_requests DROP COLUMN details');
    }
}
exports.ReservationGroupRequestDetails1758400000000 = ReservationGroupRequestDetails1758400000000;
