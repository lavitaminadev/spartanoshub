import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Solicitudes de contacto que deja quien califica bajo en una encuesta.
 *
 * El flujo de reseñas canaliza primero al equipo lo que iba a terminar en Google: si la
 * calificación queda bajo el umbral, se ofrece que alguien contacte a la persona. Esa
 * solicitud necesita tabla propia porque tiene ciclo de vida y responsable —pendiente,
 * contactada, resuelta— mientras la respuesta de la encuesta permanece inmutable.
 *
 * `response_id` es único: cada respuesta genera a lo sumo una solicitud, de modo que un doble
 * clic en "sí, que me contacten" no abre dos tickets para el mismo reclamo.
 */
export class SurveyContactRequests1726900002000 implements MigrationInterface {
  name = 'SurveyContactRequests1726900002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('survey_contact_requests')) return;

    await queryRunner.createTable(new Table({
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

    await queryRunner.createIndex('survey_contact_requests', new TableIndex({
      name: 'UQ_survey_contact_requests_response', columnNames: ['response_id'], isUnique: true,
    }));
    // El panel de seguimiento lista por encuesta y de lo más reciente a lo más antiguo.
    await queryRunner.createIndex('survey_contact_requests', new TableIndex({
      name: 'IDX_survey_contact_requests_form', columnNames: ['form_id', 'created_at'],
    }));
    await queryRunner.createIndex('survey_contact_requests', new TableIndex({
      name: 'IDX_survey_contact_requests_org_status', columnNames: ['organization_id', 'status'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('survey_contact_requests')) await queryRunner.dropTable('survey_contact_requests');
  }
}
