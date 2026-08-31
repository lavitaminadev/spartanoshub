"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadExcluidoDeMeta1757400000000 = void 0;
class LeadExcluidoDeMeta1757400000000 {
    constructor() {
        this.name = 'LeadExcluidoDeMeta1757400000000';
    }
    async falta(queryRunner) {
        const filas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'leads'
        AND column_name = 'excluded_from_meta'
    `);
        return Number(filas?.[0]?.n ?? 0) === 0;
    }
    async up(queryRunner) {
        if (!(await this.falta(queryRunner)))
            return;
        await queryRunner.query('ALTER TABLE leads ADD COLUMN excluded_from_meta TINYINT(1) NOT NULL DEFAULT 0');
    }
    async down(queryRunner) {
        if (await this.falta(queryRunner))
            return;
        await queryRunner.query('ALTER TABLE leads DROP COLUMN excluded_from_meta');
    }
}
exports.LeadExcluidoDeMeta1757400000000 = LeadExcluidoDeMeta1757400000000;
