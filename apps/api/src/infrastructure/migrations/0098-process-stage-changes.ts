import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Recorrido de solicitudes, piezas y aprobaciones.
 *
 * Cada una guarda en su tabla dónde está hoy y pisa el valor anterior en cada cambio. Con eso se
 * responde cuántas piezas hay en revisión, pero no cuánto tardan en llegar, en qué etapa se
 * atascan ni cuántas retroceden. Solo el pipeline comercial tenía sus transiciones guardadas.
 *
 * Generaliza `crm_opportunity_stage_changes` por `subject_type` + `subject_id`, igual que
 * `process_comments` hace con la conversación. Aquel se mantiene aparte: guarda además el motivo
 * de pérdida y alimenta las automatizaciones comerciales, así que fundirlos obligaría a migrar
 * filas vivas para no ganar nada.
 *
 * Dos índices porque son dos preguntas y ninguna sirve a la otra: el recorrido de un objeto
 * concreto —por objeto, en orden— y el agregado por etapa de un proceso completo.
 *
 * Lo creado antes de esta migración no tiene historial, y su primera transición quedará con
 * `duration_hours` nula. Es a propósito: rellenarla exigiría inventar una fecha de entrada que
 * nadie registró, y un dato inventado en un informe de duración es peor que un vacío declarado.
 */
export class ProcessStageChanges1755600000000 implements MigrationInterface {
  name = 'ProcessStageChanges1755600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('process_stage_changes')) return;

    await queryRunner.createTable(new Table({
      name: 'process_stage_changes',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'organization_id', type: 'varchar', length: '36' },
        { name: 'subject_type', type: 'varchar', length: '30' },
        { name: 'subject_id', type: 'varchar', length: '36' },
        { name: 'from_stage', type: 'varchar', length: '50', isNullable: true },
        { name: 'to_stage', type: 'varchar', length: '50' },
        { name: 'duration_hours', type: 'decimal', precision: 12, scale: 2, isNullable: true },
        { name: 'changed_by', type: 'varchar', length: '36', isNullable: true },
        { name: 'reason', type: 'varchar', length: '300', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createIndex('process_stage_changes', new TableIndex({
      name: 'IDX_process_stage_changes_subject',
      columnNames: ['subject_type', 'subject_id', 'created_at'],
    }));

    await queryRunner.createIndex('process_stage_changes', new TableIndex({
      name: 'IDX_process_stage_changes_org_stage',
      columnNames: ['organization_id', 'subject_type', 'to_stage', 'created_at'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('process_stage_changes')) {
      await queryRunner.dropTable('process_stage_changes');
    }
  }
}
