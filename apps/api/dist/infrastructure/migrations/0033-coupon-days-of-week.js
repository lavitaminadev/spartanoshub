"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddCouponDaysOfWeek1710000000033 = void 0;
const typeorm_1 = require("typeorm");
class AddCouponDaysOfWeek1710000000033 {
    constructor() {
        this.name = 'AddCouponDaysOfWeek1710000000033';
    }
    async up(queryRunner) {
        if (!await queryRunner.hasColumn('reservation_coupons', 'valid_days_of_week')) {
            await queryRunner.addColumn('reservation_coupons', new typeorm_1.TableColumn({ name: 'valid_days_of_week', type: 'json', isNullable: true }));
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('reservation_coupons', 'valid_days_of_week')) {
            await queryRunner.dropColumn('reservation_coupons', 'valid_days_of_week');
        }
    }
}
exports.AddCouponDaysOfWeek1710000000033 = AddCouponDaysOfWeek1710000000033;
//# sourceMappingURL=0033-coupon-days-of-week.js.map