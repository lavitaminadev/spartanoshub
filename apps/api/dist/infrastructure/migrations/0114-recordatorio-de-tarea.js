"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordatorioDeTarea1756600000000 = void 0;
class RecordatorioDeTarea1756600000000 {
    constructor() {
        this.name = 'RecordatorioDeTarea1756600000000';
    }
    async up(queryRunner) {
        const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'approval_requests'
        AND column_name = 'reminder_sent'
    `);
        if (Number(columnas?.[0]?.n ?? 0) > 0)
            return;
        await queryRunner.query("ALTER TABLE approval_requests ADD COLUMN reminder_sent VARCHAR(10) NULL");
    }
    async down(queryRunner) {
        const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'approval_requests'
        AND column_name = 'reminder_sent'
    `);
        if (Number(columnas?.[0]?.n ?? 0) === 0)
            return;
        await queryRunner.query('ALTER TABLE approval_requests DROP COLUMN reminder_sent');
    }
}
exports.RecordatorioDeTarea1756600000000 = RecordatorioDeTarea1756600000000;
