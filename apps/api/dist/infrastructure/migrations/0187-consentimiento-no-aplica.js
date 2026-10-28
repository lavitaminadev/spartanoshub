"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsentimientoNoAplica1790000000187 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class ConsentimientoNoAplica1790000000187 {
    constructor() {
        this.name = 'ConsentimientoNoAplica1790000000187';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('reservation_forms')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservation_forms', 'consentimiento_no_aplica'))) {
            await queryRunner.query('ALTER TABLE reservation_forms ADD COLUMN consentimiento_no_aplica TINYINT(1) NOT NULL DEFAULT 0');
        }
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservation_forms', 'motivo_sin_consentimiento'))) {
            await queryRunner.query('ALTER TABLE reservation_forms ADD COLUMN motivo_sin_consentimiento VARCHAR(300) NULL');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('reservation_forms')))
            return;
        for (const columna of ['motivo_sin_consentimiento', 'consentimiento_no_aplica']) {
            if (await (0, catalogo_1.hayColumna)(queryRunner, 'reservation_forms', columna)) {
                await queryRunner.query(`ALTER TABLE reservation_forms DROP COLUMN ${columna}`);
            }
        }
    }
}
exports.ConsentimientoNoAplica1790000000187 = ConsentimientoNoAplica1790000000187;
