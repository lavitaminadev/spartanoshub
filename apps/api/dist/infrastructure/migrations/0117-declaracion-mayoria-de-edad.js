"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeclaracionMayoriaDeEdad1756900000000 = void 0;
class DeclaracionMayoriaDeEdad1756900000000 {
    constructor() {
        this.name = 'DeclaracionMayoriaDeEdad1756900000000';
    }
    async falta(queryRunner, tabla) {
        const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'adult_declared_at'
    `, [tabla]);
        return Number(columnas?.[0]?.n ?? 0) === 0;
    }
    async up(queryRunner) {
        for (const tabla of ['reservations', 'email_subscribers']) {
            if (await this.falta(queryRunner, tabla)) {
                await queryRunner.query(`ALTER TABLE ${tabla} ADD COLUMN adult_declared_at TIMESTAMP NULL`);
            }
        }
    }
    async down(queryRunner) {
        for (const tabla of ['reservations', 'email_subscribers']) {
            if (!(await this.falta(queryRunner, tabla))) {
                await queryRunner.query(`ALTER TABLE ${tabla} DROP COLUMN adult_declared_at`);
            }
        }
    }
}
exports.DeclaracionMayoriaDeEdad1756900000000 = DeclaracionMayoriaDeEdad1756900000000;
