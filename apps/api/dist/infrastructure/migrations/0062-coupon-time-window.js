"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponTimeWindow1724163000000 = void 0;
const typeorm_1 = require("typeorm");
class CouponTimeWindow1724163000000 {
    constructor() {
        this.name = 'CouponTimeWindow1724163000000';
        this.columns = ['valid_from_time', 'valid_until_time'];
    }
    async up(queryRunner) {
        for (const name of this.columns) {
            if (!(await queryRunner.hasColumn('reservation_coupons', name))) {
                await queryRunner.addColumn('reservation_coupons', new typeorm_1.TableColumn({
                    name,
                    type: 'varchar',
                    length: '5',
                    isNullable: true,
                }));
            }
        }
    }
    async down(queryRunner) {
        for (const name of this.columns) {
            if (await queryRunner.hasColumn('reservation_coupons', name)) {
                await queryRunner.dropColumn('reservation_coupons', name);
            }
        }
    }
}
exports.CouponTimeWindow1724163000000 = CouponTimeWindow1724163000000;
//# sourceMappingURL=0062-coupon-time-window.js.map