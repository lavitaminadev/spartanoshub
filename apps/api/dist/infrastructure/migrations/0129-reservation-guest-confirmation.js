"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationGuestConfirmation1758100000000 = void 0;
class ReservationGuestConfirmation1758100000000 {
    constructor() {
        this.name = 'ReservationGuestConfirmation1758100000000';
    }
    async up(queryRunner) {
        const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reservations' AND column_name = 'guest_confirmed_at'");
        if (Number(rows?.[0]?.n ?? 0) === 0)
            await queryRunner.query('ALTER TABLE reservations ADD COLUMN guest_confirmed_at TIMESTAMP NULL');
    }
    async down(queryRunner) {
        const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reservations' AND column_name = 'guest_confirmed_at'");
        if (Number(rows?.[0]?.n ?? 0) > 0)
            await queryRunner.query('ALTER TABLE reservations DROP COLUMN guest_confirmed_at');
    }
}
exports.ReservationGuestConfirmation1758100000000 = ReservationGuestConfirmation1758100000000;
