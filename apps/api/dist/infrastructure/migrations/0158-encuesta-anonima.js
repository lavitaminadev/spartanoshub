"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncuestaAnonima1790000000158 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class EncuestaAnonima1790000000158 {
    constructor() {
        this.name = 'EncuestaAnonima1790000000158';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('surveys')))
            return;
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'surveys', 'anonymous'))
            return;
        await queryRunner.query('ALTER TABLE surveys ADD COLUMN anonymous TINYINT(1) NOT NULL DEFAULT 0');
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('surveys') && await (0, catalogo_1.hayColumna)(queryRunner, 'surveys', 'anonymous')) {
            await queryRunner.query('ALTER TABLE surveys DROP COLUMN anonymous');
        }
    }
}
exports.EncuestaAnonima1790000000158 = EncuestaAnonima1790000000158;
