"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComparacionDentroDelInforme1790000000188 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class ComparacionDentroDelInforme1790000000188 {
    constructor() {
        this.name = 'ComparacionDentroDelInforme1790000000188';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('monthly_reports')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'monthly_reports', 'metrics_previous'))) {
            await queryRunner.query('ALTER TABLE monthly_reports ADD COLUMN metrics_previous JSON NULL');
        }
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'monthly_reports', 'previous_period_start'))) {
            await queryRunner.query('ALTER TABLE monthly_reports ADD COLUMN previous_period_start DATE NULL');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('monthly_reports')))
            return;
        for (const columna of ['previous_period_start', 'metrics_previous']) {
            if (await (0, catalogo_1.hayColumna)(queryRunner, 'monthly_reports', columna)) {
                await queryRunner.query(`ALTER TABLE monthly_reports DROP COLUMN ${columna}`);
            }
        }
    }
}
exports.ComparacionDentroDelInforme1790000000188 = ComparacionDentroDelInforme1790000000188;
