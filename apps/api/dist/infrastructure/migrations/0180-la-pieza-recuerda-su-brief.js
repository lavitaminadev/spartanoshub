"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaPiezaRecuerdaSuBrief1790000000180 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class LaPiezaRecuerdaSuBrief1790000000180 {
    constructor() {
        this.name = 'LaPiezaRecuerdaSuBrief1790000000180';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('pieces')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'pieces', 'brief_id'))) {
            await queryRunner.query('ALTER TABLE pieces ADD COLUMN brief_id CHAR(36) NULL');
        }
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'pieces', 'IDX_pieces_brief'))) {
            await queryRunner.query('CREATE INDEX IDX_pieces_brief ON pieces (brief_id)');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('pieces')))
            return;
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'pieces', 'IDX_pieces_brief')) {
            await queryRunner.query('DROP INDEX IDX_pieces_brief ON pieces');
        }
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'pieces', 'brief_id')) {
            await queryRunner.query('ALTER TABLE pieces DROP COLUMN brief_id');
        }
    }
}
exports.LaPiezaRecuerdaSuBrief1790000000180 = LaPiezaRecuerdaSuBrief1790000000180;
