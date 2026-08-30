"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordatorioDeReserva1757300000000 = void 0;
class RecordatorioDeReserva1757300000000 {
    constructor() {
        this.name = 'RecordatorioDeReserva1757300000000';
    }
    async falta(queryRunner) {
        const filas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'reservations'
        AND column_name = 'reminder_sent_at'
    `);
        return Number(filas?.[0]?.n ?? 0) === 0;
    }
    async up(queryRunner) {
        if (!(await this.falta(queryRunner)))
            return;
        await queryRunner.query('ALTER TABLE reservations ADD COLUMN reminder_sent_at TIMESTAMP NULL');
    }
    async down(queryRunner) {
        if (await this.falta(queryRunner))
            return;
        await queryRunner.query('ALTER TABLE reservations DROP COLUMN reminder_sent_at');
    }
}
exports.RecordatorioDeReserva1757300000000 = RecordatorioDeReserva1757300000000;
