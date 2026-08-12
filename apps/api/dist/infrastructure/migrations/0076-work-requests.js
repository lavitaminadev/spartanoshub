"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkRequests1726100000000 = void 0;
const typeorm_1 = require("typeorm");
class WorkRequests1726100000000 {
    constructor() {
        this.name = 'WorkRequests1726100000000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('work_requests'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'work_requests',
            columns: [
                { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                { name: 'organization_id', type: 'varchar', length: '36' },
                { name: 'client_id', type: 'varchar', length: '36' },
                { name: 'code', type: 'varchar', length: '20' },
                { name: 'area', type: 'varchar', length: '30' },
                { name: 'title', type: 'varchar', length: '200' },
                { name: 'description', type: 'text', isNullable: true },
                { name: 'priority', type: 'varchar', length: '20', default: "'normal'" },
                { name: 'status', type: 'varchar', length: '20', default: "'new'" },
                { name: 'needed_by', type: 'date', isNullable: true },
                { name: 'requested_by', type: 'varchar', length: '36' },
                { name: 'assigned_to', type: 'varchar', length: '36', isNullable: true },
                { name: 'creative_fields', type: 'json', isNullable: true },
                { name: 'operational_fields', type: 'json', isNullable: true },
                { name: 'rejection_reason', type: 'varchar', length: '500', isNullable: true },
                { name: 'piece_ids', type: 'json', isNullable: true },
                { name: 'session_id', type: 'varchar', length: '36', isNullable: true },
                { name: 'reviewed_at', type: 'timestamp', isNullable: true },
                { name: 'resolved_at', type: 'timestamp', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('work_requests', new typeorm_1.TableIndex({
            name: 'UQ_work_requests_org_code', columnNames: ['organization_id', 'code'], isUnique: true,
        }));
        await queryRunner.createIndex('work_requests', new typeorm_1.TableIndex({
            name: 'IDX_work_requests_org_status', columnNames: ['organization_id', 'status', 'created_at'],
        }));
        await queryRunner.createIndex('work_requests', new typeorm_1.TableIndex({
            name: 'IDX_work_requests_org_client', columnNames: ['organization_id', 'client_id'],
        }));
        await queryRunner.createIndex('work_requests', new typeorm_1.TableIndex({
            name: 'IDX_work_requests_assignee', columnNames: ['organization_id', 'assigned_to'],
        }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('work_requests'))
            await queryRunner.dropTable('work_requests');
    }
}
exports.WorkRequests1726100000000 = WorkRequests1726100000000;
