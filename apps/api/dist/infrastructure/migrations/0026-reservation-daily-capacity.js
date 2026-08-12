"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationDailyCapacity1710000000026 = void 0;
const typeorm_1 = require("typeorm");
class ReservationDailyCapacity1710000000026 {
    constructor() {
        this.name = 'ReservationDailyCapacity1710000000026';
    }
    async up(queryRunner) {
        if (!await queryRunner.hasColumn('reservation_forms', 'daily_capacity')) {
            await queryRunner.addColumn('reservation_forms', new typeorm_1.TableColumn({
                name: 'daily_capacity',
                type: 'smallint',
                default: 0,
                isNullable: false,
            }));
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('reservation_forms', 'daily_capacity')) {
            await queryRunner.dropColumn('reservation_forms', 'daily_capacity');
        }
    }
}
exports.ReservationDailyCapacity1710000000026 = ReservationDailyCapacity1710000000026;
