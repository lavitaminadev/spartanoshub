"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadEstimatedAmount1755900000000 = void 0;
const typeorm_1 = require("typeorm");
class LeadEstimatedAmount1755900000000 {
    constructor() {
        this.name = 'LeadEstimatedAmount1755900000000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('leads')))
            return;
        if (await queryRunner.hasColumn('leads', 'estimated_amount'))
            return;
        await queryRunner.addColumn('leads', new typeorm_1.TableColumn({
            name: 'estimated_amount',
            type: 'decimal',
            precision: 14,
            scale: 2,
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('leads', 'estimated_amount')) {
            await queryRunner.dropColumn('leads', 'estimated_amount');
        }
    }
}
exports.LeadEstimatedAmount1755900000000 = LeadEstimatedAmount1755900000000;
