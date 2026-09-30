"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CuponEnLaCampana1790000000164 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class CuponEnLaCampana1790000000164 {
    constructor() {
        this.name = 'CuponEnLaCampana1790000000164';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('email_campaigns')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'email_campaigns', 'cupon'))) {
            await queryRunner.query('ALTER TABLE email_campaigns ADD COLUMN cupon VARCHAR(40) NULL');
        }
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'email_campaigns', 'cupon_vence'))) {
            await queryRunner.query('ALTER TABLE email_campaigns ADD COLUMN cupon_vence TIMESTAMP NULL');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('email_campaigns')))
            return;
        for (const columna of ['cupon_vence', 'cupon']) {
            if (await (0, catalogo_1.hayColumna)(queryRunner, 'email_campaigns', columna)) {
                await queryRunner.query(`ALTER TABLE email_campaigns DROP COLUMN ${columna}`);
            }
        }
    }
}
exports.CuponEnLaCampana1790000000164 = CuponEnLaCampana1790000000164;
