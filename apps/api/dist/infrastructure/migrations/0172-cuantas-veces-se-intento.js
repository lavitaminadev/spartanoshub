"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CuantasVecesSeIntento1790000000172 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class CuantasVecesSeIntento1790000000172 {
    constructor() {
        this.name = 'CuantasVecesSeIntento1790000000172';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('leads')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'leads', 'intentos_de_contacto'))) {
            await queryRunner.query('ALTER TABLE leads ADD COLUMN intentos_de_contacto TINYINT UNSIGNED NULL');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('leads')))
            return;
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'leads', 'intentos_de_contacto')) {
            await queryRunner.query('ALTER TABLE leads DROP COLUMN intentos_de_contacto');
        }
    }
}
exports.CuantasVecesSeIntento1790000000172 = CuantasVecesSeIntento1790000000172;
