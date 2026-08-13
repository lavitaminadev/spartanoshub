"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateReservationCatalog0087 = void 0;
const typeorm_1 = require("typeorm");
class CreateReservationCatalog0087 {
    constructor() {
        this.name = 'CreateReservationCatalog0087';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('reservation_catalog'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'reservation_catalog',
            columns: [
                { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                { name: 'organization_id', type: 'varchar', length: '36', isNullable: true },
                { name: 'payload', type: 'json' },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('reservation_catalog', new typeorm_1.TableIndex({ name: 'UQ_reservation_catalog_org', columnNames: ['organization_id'], isUnique: true }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('reservation_catalog'))
            await queryRunner.dropTable('reservation_catalog');
    }
}
exports.CreateReservationCatalog0087 = CreateReservationCatalog0087;
