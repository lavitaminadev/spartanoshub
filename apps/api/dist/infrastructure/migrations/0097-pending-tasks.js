"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingTasks1755500400000 = void 0;
const typeorm_1 = require("typeorm");
class PendingTasks1755500400000 {
    constructor() {
        this.name = 'PendingTasks1755500400000';
        this.indexes = [
            { name: 'IDX_approval_requests_assignee_open', columnNames: ['assigned_to', 'status', 'due_at'] },
            { name: 'IDX_approval_requests_kind_due', columnNames: ['kind', 'status', 'due_at'] },
        ];
    }
    async up(queryRunner) {
        const table = await queryRunner.getTable('approval_requests');
        if (!table)
            return;
        if (!table.findColumnByName('kind')) {
            await queryRunner.query("ALTER TABLE `approval_requests` ADD COLUMN `kind` VARCHAR(20) NOT NULL DEFAULT 'approval'");
        }
        for (const index of this.indexes) {
            const existing = await queryRunner.getTable('approval_requests');
            if (existing?.indices.some((item) => item.name === index.name))
                continue;
            await queryRunner.createIndex('approval_requests', new typeorm_1.TableIndex(index));
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('approval_requests');
        if (!table)
            return;
        for (const index of this.indexes) {
            if (table.indices.some((item) => item.name === index.name)) {
                await queryRunner.dropIndex('approval_requests', index.name);
            }
        }
    }
}
exports.PendingTasks1755500400000 = PendingTasks1755500400000;
