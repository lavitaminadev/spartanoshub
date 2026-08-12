"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Surveys1726400300000 = void 0;
const typeorm_1 = require("typeorm");
class Surveys1726400300000 {
    constructor() {
        this.name = 'Surveys1726400300000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('surveys'))) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'surveys',
                columns: [
                    { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
                    { name: 'organization_id', type: 'varchar', length: '36' },
                    { name: 'title', type: 'varchar', length: '200' },
                    { name: 'type', type: 'varchar', length: '20' },
                    { name: 'questions', type: 'json' },
                    { name: 'status', type: 'varchar', length: '20', default: "'draft'" },
                    { name: 'created_by', type: 'varchar', length: '36' },
                    { name: 'recipients', type: 'json', isNullable: true },
                    { name: 'distribution', type: 'json', isNullable: true },
                    { name: 'response_count', type: 'int', default: 0 },
                    { name: 'design_config', type: 'json', isNullable: true },
                    { name: 'google_review', type: 'json', isNullable: true },
                    { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                    { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
                ],
            }), true);
            await queryRunner.createIndex('surveys', new typeorm_1.TableIndex({
                name: 'IDX_survey_org_status',
                columnNames: ['organization_id', 'status'],
            }));
        }
        if (!(await queryRunner.hasTable('survey_responses'))) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'survey_responses',
                columns: [
                    { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
                    { name: 'organization_id', type: 'varchar', length: '36' },
                    { name: 'survey_id', type: 'varchar', length: '36' },
                    { name: 'respondent_id', type: 'varchar', length: '100' },
                    { name: 'answers', type: 'json' },
                    { name: 'submitted_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                ],
            }), true);
            await queryRunner.createIndex('survey_responses', new typeorm_1.TableIndex({
                name: 'IDX_survey_response_survey',
                columnNames: ['survey_id'],
            }));
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('survey_responses'))
            await queryRunner.dropTable('survey_responses');
        if (await queryRunner.hasTable('surveys'))
            await queryRunner.dropTable('surveys');
    }
}
exports.Surveys1726400300000 = Surveys1726400300000;
