"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationMetaTracking1710000000027 = void 0;
const typeorm_1 = require("typeorm");
class ReservationMetaTracking1710000000027 {
    constructor() {
        this.name = 'ReservationMetaTracking1710000000027';
    }
    async up(queryRunner) {
        for (const column of [
            { name: 'fbc', type: 'varchar', length: '255', isNullable: true },
            { name: 'fbp', type: 'varchar', length: '255', isNullable: true },
            { name: 'client_ip_address', type: 'varchar', length: '100', isNullable: true },
            { name: 'client_user_agent', type: 'varchar', length: '500', isNullable: true },
        ]) {
            if (!await queryRunner.hasColumn('reservations', column.name)) {
                await queryRunner.addColumn('reservations', new typeorm_1.TableColumn(column));
            }
        }
    }
    async down(queryRunner) {
        for (const columnName of ['client_user_agent', 'client_ip_address', 'fbp', 'fbc']) {
            if (await queryRunner.hasColumn('reservations', columnName)) {
                await queryRunner.dropColumn('reservations', columnName);
            }
        }
    }
}
exports.ReservationMetaTracking1710000000027 = ReservationMetaTracking1710000000027;
//# sourceMappingURL=0027-reservation-meta-tracking.js.map