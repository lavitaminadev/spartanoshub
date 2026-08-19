import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * Índices para las consultas del CRM.
 *
 * `leads` tenía uno solo, el único sobre `external_id`, que sirve para deduplicar al recibir pero
 * no cubre ninguna de las preguntas que hace la pantalla de inicio: cuántos sin contactar, cuántos
 * sin dueño, cuántos sin movimiento, y cuánto lleva cada persona.
 *
 * Sin ellos cada una recorre la tabla completa, y el inicio corre **en cada entrada al CRM**. Con
 * unos cientos de leads no se nota; con decenas de miles, en un servidor de 768 MB compartidos, es
 * la diferencia entre abrir y esperar.
 *
 * Son dos y no cinco a propósito: cada índice se paga en cada escritura y en espacio. Estos dos
 * cubren las cuatro consultas porque comparten el prefijo `organization_id`, que está presente en
 * todas por aislamiento de datos.
 */
export class LeadCrmIndexes1755800000000 implements MigrationInterface {
  name = 'LeadCrmIndexes1755800000000';

  /**
   * `(organization_id, status, updated_at)` sirve a tres consultas por prefijo: filtrar por
   * estado, contar los abiertos, y encontrar los que llevan días sin moverse. El orden importa:
   * `status` antes que `updated_at` porque siempre se filtra por igualdad y la fecha por rango, y
   * un rango antes de una igualdad corta el uso del resto del índice.
   */
  private static readonly ORG_STATUS = 'IDX_leads_org_status_updated';

  /**
   * `(organization_id, assigned_to)` sirve a «sin asignar» y a la carga por persona, que es una
   * agrupación por esa misma columna.
   */
  private static readonly ORG_ASSIGNED = 'IDX_leads_org_assigned';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('leads'))) return;
    const tabla = await queryRunner.getTable('leads');

    if (!tabla?.indices.some((i) => i.name === LeadCrmIndexes1755800000000.ORG_STATUS)) {
      await queryRunner.createIndex('leads', new TableIndex({
        name: LeadCrmIndexes1755800000000.ORG_STATUS,
        columnNames: ['organization_id', 'status', 'updated_at'],
      }));
    }

    if (!tabla?.indices.some((i) => i.name === LeadCrmIndexes1755800000000.ORG_ASSIGNED)) {
      await queryRunner.createIndex('leads', new TableIndex({
        name: LeadCrmIndexes1755800000000.ORG_ASSIGNED,
        columnNames: ['organization_id', 'assigned_to'],
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('leads'))) return;
    const tabla = await queryRunner.getTable('leads');

    for (const nombre of [LeadCrmIndexes1755800000000.ORG_STATUS, LeadCrmIndexes1755800000000.ORG_ASSIGNED]) {
      if (tabla?.indices.some((i) => i.name === nombre)) await queryRunner.dropIndex('leads', nombre);
    }
  }
}
