"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodigoDelCuponEnviado1790000000170 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class CodigoDelCuponEnviado1790000000170 {
    constructor() {
        this.name = 'CodigoDelCuponEnviado1790000000170';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('reservations')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservations', 'cupon_enviado_codigo'))) {
            await queryRunner.query('ALTER TABLE reservations ADD COLUMN cupon_enviado_codigo VARCHAR(40) NULL');
        }
        const indices = await queryRunner.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'IDX_reservations_cupon_enviado_codigo'");
        if (!indices.length) {
            await queryRunner.query('CREATE INDEX IDX_reservations_cupon_enviado_codigo ON reservations (organization_id, cupon_enviado_codigo)');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('reservations')))
            return;
        const indices = await queryRunner.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'IDX_reservations_cupon_enviado_codigo'");
        if (indices.length)
            await queryRunner.query('DROP INDEX IDX_reservations_cupon_enviado_codigo ON reservations');
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'reservations', 'cupon_enviado_codigo')) {
            await queryRunner.query('ALTER TABLE reservations DROP COLUMN cupon_enviado_codigo');
        }
    }
}
exports.CodigoDelCuponEnviado1790000000170 = CodigoDelCuponEnviado1790000000170;
