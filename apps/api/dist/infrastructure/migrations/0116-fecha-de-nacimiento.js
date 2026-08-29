"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FechaDeNacimiento1756800000000 = void 0;
class FechaDeNacimiento1756800000000 {
    constructor() {
        this.name = 'FechaDeNacimiento1756800000000';
    }
    async falta(queryRunner, tabla) {
        const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'birth_date'
    `, [tabla]);
        return Number(columnas?.[0]?.n ?? 0) === 0;
    }
    async up(queryRunner) {
        if (await this.falta(queryRunner, 'email_subscribers')) {
            await queryRunner.query('ALTER TABLE email_subscribers ADD COLUMN birth_date DATE NULL');
        }
        if (await this.falta(queryRunner, 'leads')) {
            await queryRunner.query('ALTER TABLE leads ADD COLUMN birth_date DATE NULL');
        }
    }
    async down(queryRunner) {
        if (!(await this.falta(queryRunner, 'email_subscribers'))) {
            await queryRunner.query('ALTER TABLE email_subscribers DROP COLUMN birth_date');
        }
        if (!(await this.falta(queryRunner, 'leads'))) {
            await queryRunner.query('ALTER TABLE leads DROP COLUMN birth_date');
        }
    }
}
exports.FechaDeNacimiento1756800000000 = FechaDeNacimiento1756800000000;
