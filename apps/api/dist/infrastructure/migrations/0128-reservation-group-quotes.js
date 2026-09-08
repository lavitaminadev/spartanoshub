"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationGroupQuotes1758000000000 = void 0;
class ReservationGroupQuotes1758000000000 {
    constructor() {
        this.name = 'ReservationGroupQuotes1758000000000';
    }
    async up(queryRunner) { for (const [column, type] of [['quote_amount', 'DECIMAL(12,2) NULL'], ['quote_message', 'TEXT NULL'], ['quote_expires_at', 'TIMESTAMP NULL']]) {
        const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reservation_group_requests' AND column_name = ?", [column]);
        if (Number(rows?.[0]?.n ?? 0) === 0)
            await queryRunner.query(`ALTER TABLE reservation_group_requests ADD COLUMN ${column} ${type}`);
    } }
    async down(queryRunner) { for (const column of ['quote_expires_at', 'quote_message', 'quote_amount']) {
        const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reservation_group_requests' AND column_name = ?", [column]);
        if (Number(rows?.[0]?.n ?? 0) > 0)
            await queryRunner.query(`ALTER TABLE reservation_group_requests DROP COLUMN ${column}`);
    } }
}
exports.ReservationGroupQuotes1758000000000 = ReservationGroupQuotes1758000000000;
