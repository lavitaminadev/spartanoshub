"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessComments1726900010000 = void 0;
const typeorm_1 = require("typeorm");
class ProcessComments1726900010000 {
    constructor() {
        this.name = 'ProcessComments1726900010000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('process_comments'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'process_comments',
            columns: [
                { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                { name: 'organization_id', type: 'varchar', length: '36' },
                { name: 'subject_type', type: 'varchar', length: '20' },
                { name: 'subject_id', type: 'varchar', length: '36' },
                { name: 'author_id', type: 'varchar', length: '36', isNullable: true },
                { name: 'author_role', type: 'varchar', length: '40', isNullable: true },
                { name: 'author_name', type: 'varchar', length: '120', isNullable: true },
                { name: 'body', type: 'text' },
                { name: 'visibility', type: 'varchar', length: '20', default: "'internal'" },
                { name: 'edited_at', type: 'timestamp', isNullable: true },
                { name: 'anonymized_at', type: 'timestamp', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('process_comments', new typeorm_1.TableIndex({
            name: 'IDX_process_comment_subject',
            columnNames: ['organization_id', 'subject_type', 'subject_id', 'created_at'],
        }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('process_comments')) {
            await queryRunner.dropTable('process_comments');
        }
    }
}
exports.ProcessComments1726900010000 = ProcessComments1726900010000;
