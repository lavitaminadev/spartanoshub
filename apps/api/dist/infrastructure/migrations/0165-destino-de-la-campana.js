"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DestinoDeLaCampana1790000000165 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class DestinoDeLaCampana1790000000165 {
    constructor() {
        this.name = 'DestinoDeLaCampana1790000000165';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('email_campaigns')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'email_campaigns', 'destino'))) {
            await queryRunner.query("ALTER TABLE email_campaigns ADD COLUMN destino VARCHAR(20) NOT NULL DEFAULT 'lista'");
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('email_campaigns')))
            return;
        for (const columna of ['destino']) {
            if (await (0, catalogo_1.hayColumna)(queryRunner, 'email_campaigns', columna)) {
                await queryRunner.query(`ALTER TABLE email_campaigns DROP COLUMN ${columna}`);
            }
        }
    }
}
exports.DestinoDeLaCampana1790000000165 = DestinoDeLaCampana1790000000165;
