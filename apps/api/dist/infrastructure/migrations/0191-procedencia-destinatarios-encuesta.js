"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcedenciaDestinatariosEncuesta1790000000191 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class ProcedenciaDestinatariosEncuesta1790000000191 {
    constructor() {
        this.name = 'ProcedenciaDestinatariosEncuesta1790000000191';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('surveys')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'surveys', 'recipient_source')))
            await queryRunner.query('ALTER TABLE surveys ADD COLUMN recipient_source VARCHAR(255) NULL');
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'surveys', 'recipient_basis')))
            await queryRunner.query('ALTER TABLE surveys ADD COLUMN recipient_basis VARCHAR(500) NULL');
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('surveys')))
            return;
        for (const column of ['recipient_basis', 'recipient_source'])
            if (await (0, catalogo_1.hayColumna)(queryRunner, 'surveys', column))
                await queryRunner.query(`ALTER TABLE surveys DROP COLUMN ${column}`);
    }
}
exports.ProcedenciaDestinatariosEncuesta1790000000191 = ProcedenciaDestinatariosEncuesta1790000000191;
