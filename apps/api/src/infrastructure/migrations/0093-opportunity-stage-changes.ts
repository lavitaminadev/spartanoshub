import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Recorrido de cada trato por el pipeline.
 *
 * `crm_opportunities.stage` dice dónde está el trato hoy y pisa el valor anterior en cada
 * cambio. Con eso se responde cuántos tratos hay en negociación, pero no cuánto tardan en
 * llegar, en qué etapa se atascan ni cuántos retroceden. Toda pregunta sobre el recorrido
 * necesita las transiciones, y no se estaban guardando en ninguna parte.
 *
 * Dos índices porque son dos preguntas distintas y ninguna sirve a la otra: el historial de
 * un trato concreto —por `opportunity_id`, en orden— y el agregado del pipeline por etapa
 * —por organización y etapa de destino—.
 *
 * Los tratos abiertos antes de esta migración no tienen historial y su primera transición
 * quedará con `duration_hours` nula. Es a propósito: rellenarla exigiría inventar una fecha
 * de entrada a la etapa que nadie registró, y un dato inventado en un informe de duración es
 * peor que un vacío declarado.
 */
export class OpportunityStageChanges1755500000000 implements MigrationInterface {
  name = 'OpportunityStageChanges1755500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('crm_opportunity_stage_changes')) return;

    await queryRunner.createTable(new Table({
      name: 'crm_opportunity_stage_changes',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'organization_id', type: 'varchar', length: '36' },
        { name: 'opportunity_id', type: 'varchar', length: '36' },
        { name: 'from_stage', type: 'varchar', length: '50', isNullable: true },
        { name: 'to_stage', type: 'varchar', length: '50' },
        { name: 'duration_hours', type: 'decimal', precision: 12, scale: 2, isNullable: true },
        { name: 'changed_by', type: 'varchar', length: '36', isNullable: true },
        { name: 'loss_reason', type: 'varchar', length: '60', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createIndex('crm_opportunity_stage_changes', new TableIndex({
      name: 'IDX_opportunity_stage_changes_opportunity',
      columnNames: ['opportunity_id', 'created_at'],
    }));

    await queryRunner.createIndex('crm_opportunity_stage_changes', new TableIndex({
      name: 'IDX_opportunity_stage_changes_org_stage',
      columnNames: ['organization_id', 'to_stage', 'created_at'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('crm_opportunity_stage_changes')) {
      await queryRunner.dropTable('crm_opportunity_stage_changes');
    }
  }
}
