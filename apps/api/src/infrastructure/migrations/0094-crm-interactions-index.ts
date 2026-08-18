import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * Índice que le faltaba a `crm_interactions`.
 *
 * Sus dos tablas hermanas —`crm_contacts` y `crm_opportunities`— ya tienen un índice
 * compuesto por organización y fecha, y esta quedó sin él. La consulta que se hace siempre es
 * la misma: las interacciones de un lead, en orden. Sin índice eso recorre la tabla completa,
 * y es la tabla del CRM que más rápido crece porque la automatización de captura escribe una
 * fila por cada lead que entra.
 */
export class CrmInteractionsIndex1755500100000 implements MigrationInterface {
  name = 'CrmInteractionsIndex1755500100000';

  private readonly indexName = 'IDX_crm_interactions_org_lead_date';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('crm_interactions');
    if (!table || table.indices.some((index) => index.name === this.indexName)) return;

    await queryRunner.createIndex('crm_interactions', new TableIndex({
      name: this.indexName,
      columnNames: ['organization_id', 'lead_id', 'date'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('crm_interactions');
    if (table?.indices.some((index) => index.name === this.indexName)) {
      await queryRunner.dropIndex('crm_interactions', this.indexName);
    }
  }
}
