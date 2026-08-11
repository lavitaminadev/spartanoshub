"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateKnowledgeChunks1721767000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateKnowledgeChunks1721767000000 {
    constructor() {
        this.name = 'CreateKnowledgeChunks1721767000000';
    }
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'knowledge_chunks',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
                { name: 'tenant_id', type: 'uuid' },
                { name: 'content', type: 'text' },
                { name: 'embedding', type: 'json' },
                { name: 'source_name', type: 'varchar', length: '255' },
                { name: 'chunk_index', type: 'int' },
                { name: 'token_count', type: 'int' },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('knowledge_chunks', new typeorm_1.TableIndex({
            name: 'IDX_knowledge_chunks_tenant', columnNames: ['tenant_id'],
        }));
        await queryRunner.createIndex('knowledge_chunks', new typeorm_1.TableIndex({
            name: 'IDX_knowledge_chunks_tenant_source', columnNames: ['tenant_id', 'source_name'],
        }));
        await queryRunner.createForeignKey('knowledge_chunks', new typeorm_1.TableForeignKey({
            columnNames: ['tenant_id'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('knowledge_chunks');
    }
}
exports.CreateKnowledgeChunks1721767000000 = CreateKnowledgeChunks1721767000000;
//# sourceMappingURL=0055-create-knowledge-chunks.js.map