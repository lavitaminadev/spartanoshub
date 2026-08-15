"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationDayLocks1726900005000 = void 0;
const typeorm_1 = require("typeorm");
class ReservationDayLocks1726900005000 {
    constructor() {
        this.name = 'ReservationDayLocks1726900005000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('reservation_day_locks'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'reservation_day_locks',
            columns: [
                { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                { name: 'client_id', type: 'varchar', length: '36' },
                { name: 'day', type: 'varchar', length: '10' },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('reservation_day_locks', new typeorm_1.TableIndex({
            name: 'UQ_reservation_day_lock', columnNames: ['client_id', 'day'], isUnique: true,
        }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('reservation_day_locks')) {
            await queryRunner.dropTable('reservation_day_locks');
        }
    }
}
exports.ReservationDayLocks1726900005000 = ReservationDayLocks1726900005000;
