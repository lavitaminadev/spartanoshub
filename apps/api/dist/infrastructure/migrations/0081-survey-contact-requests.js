"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurveyContactRequests1726900002000 = void 0;
const typeorm_1 = require("typeorm");
class SurveyContactRequests1726900002000 {
    constructor() {
        this.name = 'SurveyContactRequests1726900002000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('survey_contact_requests'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'survey_contact_requests',
            columns: [
                { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                { name: 'organization_id', type: 'varchar', length: '36' },
                { name: 'client_id', type: 'varchar', length: '36' },
                { name: 'form_id', type: 'varchar', length: '36' },
                { name: 'response_id', type: 'varchar', length: '36' },
                { name: 'guest_name', type: 'varchar', length: '180', isNullable: true },
                { name: 'email', type: 'varchar', length: '190', isNullable: true },
                { name: 'phone', type: 'varchar', length: '50', isNullable: true },
                { name: 'message', type: 'text', isNullable: true },
                { name: 'rating', type: 'smallint', isNullable: true },
                { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
                { name: 'notes', type: 'text', isNullable: true },
                { name: 'resolved_by', type: 'varchar', length: '36', isNullable: true },
                { name: 'resolved_at', type: 'timestamp', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('survey_contact_requests', new typeorm_1.TableIndex({
            name: 'UQ_survey_contact_requests_response', columnNames: ['response_id'], isUnique: true,
        }));
        await queryRunner.createIndex('survey_contact_requests', new typeorm_1.TableIndex({
            name: 'IDX_survey_contact_requests_form', columnNames: ['form_id', 'created_at'],
        }));
        await queryRunner.createIndex('survey_contact_requests', new typeorm_1.TableIndex({
            name: 'IDX_survey_contact_requests_org_status', columnNames: ['organization_id', 'status'],
        }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('survey_contact_requests'))
            await queryRunner.dropTable('survey_contact_requests');
    }
}
exports.SurveyContactRequests1726900002000 = SurveyContactRequests1726900002000;
