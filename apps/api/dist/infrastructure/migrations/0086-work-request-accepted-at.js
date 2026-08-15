"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkRequestAcceptedAt1726900004000 = void 0;
const typeorm_1 = require("typeorm");
class WorkRequestAcceptedAt1726900004000 {
    constructor() {
        this.name = 'WorkRequestAcceptedAt1726900004000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasColumn('work_requests', 'accepted_at'))
            return;
        await queryRunner.addColumn('work_requests', new typeorm_1.TableColumn({ name: 'accepted_at', type: 'timestamp', isNullable: true }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('work_requests', 'accepted_at')) {
            await queryRunner.dropColumn('work_requests', 'accepted_at');
        }
    }
}
exports.WorkRequestAcceptedAt1726900004000 = WorkRequestAcceptedAt1726900004000;
