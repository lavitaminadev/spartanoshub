"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationalGovernance1710000000023 = void 0;
const typeorm_1 = require("typeorm");
class OperationalGovernance1710000000023 {
    constructor() {
        this.name = 'OperationalGovernance1710000000023';
    }
    async up(queryRunner) {
        if (await queryRunner.hasColumn('audit_logs', 'entity_id')) {
            const table = await queryRunner.getTable('audit_logs');
            const current = table?.findColumnByName('entity_id');
            if (current && !current.isNullable)
                await queryRunner.changeColumn('audit_logs', current, new typeorm_1.TableColumn({ ...current, isNullable: true }));
        }
        if (!await queryRunner.hasColumn('pieces', 'assigned_at'))
            await queryRunner.addColumn('pieces', new typeorm_1.TableColumn({ name: 'assigned_at', type: 'timestamp', isNullable: true }));
        if (!await queryRunner.hasColumn('pieces', 'started_at'))
            await queryRunner.addColumn('pieces', new typeorm_1.TableColumn({ name: 'started_at', type: 'timestamp', isNullable: true }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('pieces', 'started_at'))
            await queryRunner.dropColumn('pieces', 'started_at');
        if (await queryRunner.hasColumn('pieces', 'assigned_at'))
            await queryRunner.dropColumn('pieces', 'assigned_at');
    }
}
exports.OperationalGovernance1710000000023 = OperationalGovernance1710000000023;
//# sourceMappingURL=0023-operational-governance.js.map