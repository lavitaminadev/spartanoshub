"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedioDeLaReunion1757100000000 = void 0;
class MedioDeLaReunion1757100000000 {
    constructor() {
        this.name = 'MedioDeLaReunion1757100000000';
    }
    async falta(queryRunner, columna) {
        const filas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'crm_interactions' AND column_name = ?
    `, [columna]);
        return Number(filas?.[0]?.n ?? 0) === 0;
    }
    async up(queryRunner) {
        if (await this.falta(queryRunner, 'medium')) {
            await queryRunner.query("ALTER TABLE crm_interactions ADD COLUMN medium VARCHAR(40) NULL");
        }
        if (await this.falta(queryRunner, 'location')) {
            await queryRunner.query('ALTER TABLE crm_interactions ADD COLUMN location VARCHAR(500) NULL');
        }
    }
    async down(queryRunner) {
        if (!(await this.falta(queryRunner, 'location'))) {
            await queryRunner.query('ALTER TABLE crm_interactions DROP COLUMN location');
        }
        if (!(await this.falta(queryRunner, 'medium'))) {
            await queryRunner.query('ALTER TABLE crm_interactions DROP COLUMN medium');
        }
    }
}
exports.MedioDeLaReunion1757100000000 = MedioDeLaReunion1757100000000;
