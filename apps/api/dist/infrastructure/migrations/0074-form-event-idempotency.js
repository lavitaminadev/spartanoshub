"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormEventIdempotency1725900000000 = void 0;
const INDEX_NAME = 'UQ_form_events_form_type_session';
class FormEventIdempotency1725900000000 {
    constructor() {
        this.name = 'FormEventIdempotency1725900000000';
    }
    async up(queryRunner) {
        const table = await queryRunner.getTable('reservation_form_events');
        if (!table)
            return;
        if (table.indices.some((index) => index.name === INDEX_NAME))
            return;
        await queryRunner.query(`
      DELETE e FROM \`reservation_form_events\` e
      JOIN (
        SELECT MIN(id) AS keep_id, form_id, type, session_id
        FROM \`reservation_form_events\`
        WHERE session_id IS NOT NULL
        GROUP BY form_id, type, session_id
        HAVING COUNT(*) > 1
      ) d ON e.form_id = d.form_id AND e.type = d.type AND e.session_id = d.session_id
      WHERE e.id <> d.keep_id
    `);
        await queryRunner.query(`ALTER TABLE \`reservation_form_events\` ADD UNIQUE KEY \`${INDEX_NAME}\` (\`form_id\`, \`type\`, \`session_id\`)`);
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('reservation_form_events');
        if (!table?.indices.some((index) => index.name === INDEX_NAME))
            return;
        await queryRunner.query(`ALTER TABLE \`reservation_form_events\` DROP INDEX \`${INDEX_NAME}\``);
    }
}
exports.FormEventIdempotency1725900000000 = FormEventIdempotency1725900000000;
