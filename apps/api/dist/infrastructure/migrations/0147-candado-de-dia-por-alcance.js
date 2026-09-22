"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandadoDeDiaPorAlcance1790000000147 = void 0;
const typeorm_1 = require("typeorm");
class CandadoDeDiaPorAlcance1790000000147 {
    constructor() {
        this.name = 'CandadoDeDiaPorAlcance1790000000147';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('reservation_day_locks')))
            return;
        const tabla = await queryRunner.getTable('reservation_day_locks');
        if (tabla?.findColumnByName('scope_id'))
            return;
        if (tabla?.indices.some((indice) => indice.name === 'UQ_reservation_day_lock')) {
            await queryRunner.dropIndex('reservation_day_locks', 'UQ_reservation_day_lock');
        }
        await queryRunner.query('ALTER TABLE `reservation_day_locks` CHANGE `client_id` `scope_id` VARCHAR(36) NOT NULL');
        await queryRunner.createIndex('reservation_day_locks', new typeorm_1.TableIndex({
            name: 'UQ_reservation_day_lock', columnNames: ['scope_id', 'day'], isUnique: true,
        }));
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('reservation_day_locks')))
            return;
        const tabla = await queryRunner.getTable('reservation_day_locks');
        if (!tabla?.findColumnByName('scope_id'))
            return;
        if (tabla.indices.some((indice) => indice.name === 'UQ_reservation_day_lock')) {
            await queryRunner.dropIndex('reservation_day_locks', 'UQ_reservation_day_lock');
        }
        await queryRunner.query('ALTER TABLE `reservation_day_locks` CHANGE `scope_id` `client_id` VARCHAR(36) NOT NULL');
        await queryRunner.createIndex('reservation_day_locks', new typeorm_1.TableIndex({
            name: 'UQ_reservation_day_lock', columnNames: ['client_id', 'day'], isUnique: true,
        }));
    }
}
exports.CandadoDeDiaPorAlcance1790000000147 = CandadoDeDiaPorAlcance1790000000147;
