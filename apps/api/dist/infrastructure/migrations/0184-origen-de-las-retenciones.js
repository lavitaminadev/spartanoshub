"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrigenDeLasRetenciones1790000000184 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class OrigenDeLasRetenciones1790000000184 {
    constructor() {
        this.name = 'OrigenDeLasRetenciones1790000000184';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('reservation_holds')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservation_holds', 'origin_key'))) {
            await queryRunner.query('ALTER TABLE reservation_holds ADD COLUMN origin_key VARCHAR(64) NULL');
            await queryRunner.query('CREATE INDEX IDX_reservation_hold_origin ON reservation_holds (form_id, origin_key, expires_at)');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('reservation_holds')))
            return;
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'reservation_holds', 'origin_key')) {
            await queryRunner.query('DROP INDEX IDX_reservation_hold_origin ON reservation_holds');
            await queryRunner.query('ALTER TABLE reservation_holds DROP COLUMN origin_key');
        }
    }
}
exports.OrigenDeLasRetenciones1790000000184 = OrigenDeLasRetenciones1790000000184;
