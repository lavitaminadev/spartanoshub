"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CuponPostVisita1790000000155 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class CuponPostVisita1790000000155 {
    constructor() {
        this.name = 'CuponPostVisita1790000000155';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('reservations')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservations', 'cupon_enviado_en'))) {
            await queryRunner.query('ALTER TABLE reservations ADD COLUMN cupon_enviado_en TIMESTAMP NULL');
        }
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'reservations', 'IDX_reservations_cupon_pendiente'))) {
            await queryRunner.query('CREATE INDEX IDX_reservations_cupon_pendiente ON reservations (status, cupon_enviado_en, ends_at)');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('reservations')))
            return;
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'reservations', 'IDX_reservations_cupon_pendiente')) {
            await queryRunner.query('DROP INDEX IDX_reservations_cupon_pendiente ON reservations');
        }
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'reservations', 'cupon_enviado_en')) {
            await queryRunner.query('ALTER TABLE reservations DROP COLUMN cupon_enviado_en');
        }
    }
}
exports.CuponPostVisita1790000000155 = CuponPostVisita1790000000155;
