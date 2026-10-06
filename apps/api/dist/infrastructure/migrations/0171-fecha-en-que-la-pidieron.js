"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FechaEnQueLaPidieron1790000000171 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class FechaEnQueLaPidieron1790000000171 {
    constructor() {
        this.name = 'FechaEnQueLaPidieron1790000000171';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('email_suppression')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'email_suppression', 'pedida_el'))) {
            await queryRunner.query('ALTER TABLE email_suppression ADD COLUMN pedida_el DATETIME NULL');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('email_suppression')))
            return;
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'email_suppression', 'pedida_el')) {
            await queryRunner.query('ALTER TABLE email_suppression DROP COLUMN pedida_el');
        }
    }
}
exports.FechaEnQueLaPidieron1790000000171 = FechaEnQueLaPidieron1790000000171;
