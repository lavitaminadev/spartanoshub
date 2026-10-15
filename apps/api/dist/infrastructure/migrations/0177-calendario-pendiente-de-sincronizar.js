"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarioPendienteDeSincronizar1790000000177 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class CalendarioPendienteDeSincronizar1790000000177 {
    constructor() {
        this.name = 'CalendarioPendienteDeSincronizar1790000000177';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('reservations')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservations', 'calendar_sync_pending'))) {
            await queryRunner.query('ALTER TABLE reservations ADD COLUMN calendar_sync_pending VARCHAR(10) NULL');
        }
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'reservations', 'IDX_reservation_calendar_sync_pending'))) {
            await queryRunner.query('CREATE INDEX IDX_reservation_calendar_sync_pending ON reservations (calendar_sync_pending, updated_at)');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('reservations')))
            return;
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'reservations', 'IDX_reservation_calendar_sync_pending')) {
            await queryRunner.query('DROP INDEX IDX_reservation_calendar_sync_pending ON reservations');
        }
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'reservations', 'calendar_sync_pending')) {
            await queryRunner.query('ALTER TABLE reservations DROP COLUMN calendar_sync_pending');
        }
    }
}
exports.CalendarioPendienteDeSincronizar1790000000177 = CalendarioPendienteDeSincronizar1790000000177;
