"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientDailyReservationCap1724164000000 = void 0;
const typeorm_1 = require("typeorm");
class ClientDailyReservationCap1724164000000 {
    constructor() {
        this.name = 'ClientDailyReservationCap1724164000000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasColumn('clients', 'daily_reservation_cap'))) {
            await queryRunner.addColumn('clients', new typeorm_1.TableColumn({
                name: 'daily_reservation_cap',
                type: 'smallint',
                isNullable: false,
                default: 0,
            }));
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('clients', 'daily_reservation_cap')) {
            await queryRunner.dropColumn('clients', 'daily_reservation_cap');
        }
    }
}
exports.ClientDailyReservationCap1724164000000 = ClientDailyReservationCap1724164000000;
