"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RubroDelFormulario1790000000186 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class RubroDelFormulario1790000000186 {
    constructor() {
        this.name = 'RubroDelFormulario1790000000186';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('reservation_forms')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservation_forms', 'rubro'))) {
            await queryRunner.query('ALTER TABLE reservation_forms ADD COLUMN rubro VARCHAR(40) NULL');
        }
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservation_forms', 'tipo_de_captacion'))) {
            await queryRunner.query('ALTER TABLE reservation_forms ADD COLUMN tipo_de_captacion VARCHAR(40) NULL');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('reservation_forms')))
            return;
        for (const columna of ['tipo_de_captacion', 'rubro']) {
            if (await (0, catalogo_1.hayColumna)(queryRunner, 'reservation_forms', columna)) {
                await queryRunner.query(`ALTER TABLE reservation_forms DROP COLUMN ${columna}`);
            }
        }
    }
}
exports.RubroDelFormulario1790000000186 = RubroDelFormulario1790000000186;
