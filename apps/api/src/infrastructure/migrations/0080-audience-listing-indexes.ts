import { MigrationInterface, QueryRunner } from 'typeorm';
import { dropIndexes, ensureIndexes, IndexSpec } from './helpers/indexes';

/**
 * Índices para el listado de contactos de audiencia.
 *
 * Es la única consulta del CRM que filtra por `domain` y además ordena por fecha, y no se
 * ejecuta una vez por pantalla: la pestaña pide la página y, en paralelo, un total por cada
 * estado. Los índices existentes cubren `(organization_id, domain)` y `(organization_id,
 * created_at)` por separado, de modo que el motor puede filtrar o puede ordenar, pero no
 * ambas cosas con el mismo índice, y resuelve el orden con una pasada aparte sobre el
 * resultado filtrado.
 *
 * `created_at` va descendente porque así se lee el listado, del contacto más reciente al más
 * antiguo, igual que los índices equivalentes de la migración 0050.
 */
const INDEXES: IndexSpec[] = [
  {
    table: 'leads',
    name: 'idx_org_domain_created',
    columns: ['organization_id', 'domain', 'created_at'],
    definition: '(organization_id, domain, created_at DESC)',
  },
  {
    table: 'leads',
    name: 'idx_org_domain_status',
    columns: ['organization_id', 'domain', 'status'],
  },
];

export class AudienceListingIndexes1726900001000 implements MigrationInterface {
  name = 'AudienceListingIndexes1726900001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await ensureIndexes(queryRunner, INDEXES);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await dropIndexes(queryRunner, INDEXES);
  }
}
