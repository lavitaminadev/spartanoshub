import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Motor de automatizaciones.
 *
 * Tres tablas y no seis. Los disparadores, condiciones y acciones **no** son tablas: son
 * nodos dentro del grafo en JSON. Normalizarlos obligaría a una unión de cuatro vías para
 * reconstruir algo que siempre se lee entero, y cada tipo de nodo nuevo sería una migración.
 *
 * Lo que sí es columna es lo que se consulta de forma selectiva: en cada evento del sistema
 * hay que responder "¿qué automatizaciones activas de esta organización escuchan esto?", y
 * eso tiene que resolverse por índice y no leyendo todos los grafos.
 *
 * `automation_runs` es lo que da durabilidad: el bus de eventos vive en memoria, así que un
 * disparo que no se escribe se pierde si el proceso cae. El índice único sobre `trigger_key`
 * es lo que impide ejecutar dos veces por el mismo hecho, y el de `resume_at` es lo que hace
 * que las esperas no necesiten ninguna infraestructura aparte.
 *
 * No tiene relación con `workflow_templates`, que son listas de etapas y no ejecutan nada.
 */
export class Automations1755500200000 implements MigrationInterface {
  name = 'Automations1755500200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasTable('automations')) {
      await queryRunner.createTable(new Table({
        name: 'automations',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'organization_id', type: 'varchar', length: '36' },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'trigger_type', type: 'varchar', length: '60' },
          { name: 'is_active', type: 'boolean', default: false },
          { name: 'version', type: 'int', default: 1 },
          { name: 'graph', type: 'json' },
          { name: 'run_as_user_id', type: 'varchar', length: '36' },
          { name: 'created_by', type: 'varchar', length: '36', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }), true);

      await queryRunner.createIndex('automations', new TableIndex({
        name: 'IDX_automations_org_trigger_active',
        columnNames: ['organization_id', 'trigger_type', 'is_active'],
      }));
    }

    if (!await queryRunner.hasTable('automation_runs')) {
      await queryRunner.createTable(new Table({
        name: 'automation_runs',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'organization_id', type: 'varchar', length: '36' },
          { name: 'automation_id', type: 'varchar', length: '36' },
          { name: 'automation_version', type: 'int', default: 1 },
          { name: 'trigger_key', type: 'varchar', length: '190' },
          { name: 'entity_type', type: 'varchar', length: '40' },
          { name: 'entity_id', type: 'varchar', length: '36' },
          { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
          { name: 'context', type: 'json', isNullable: true },
          { name: 'current_node_id', type: 'varchar', length: '60', isNullable: true },
          { name: 'resume_at', type: 'timestamp', isNullable: true },
          { name: 'attempts', type: 'int', default: 0 },
          { name: 'last_error', type: 'text', isNullable: true },
          { name: 'started_at', type: 'timestamp', isNullable: true },
          { name: 'finished_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }), true);

      await queryRunner.createIndex('automation_runs', new TableIndex({
        name: 'UQ_automation_runs_trigger',
        columnNames: ['organization_id', 'automation_id', 'trigger_key'],
        isUnique: true,
      }));

      await queryRunner.createIndex('automation_runs', new TableIndex({
        name: 'IDX_automation_runs_resume',
        columnNames: ['status', 'resume_at'],
      }));
    }

    if (!await queryRunner.hasTable('automation_run_steps')) {
      await queryRunner.createTable(new Table({
        name: 'automation_run_steps',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'run_id', type: 'varchar', length: '36' },
          { name: 'node_id', type: 'varchar', length: '60' },
          { name: 'node_type', type: 'varchar', length: '20' },
          { name: 'node_key', type: 'varchar', length: '60' },
          { name: 'status', type: 'varchar', length: '20' },
          { name: 'input', type: 'json', isNullable: true },
          { name: 'output', type: 'json', isNullable: true },
          { name: 'error', type: 'text', isNullable: true },
          { name: 'duration_ms', type: 'int', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }), true);

      await queryRunner.createIndex('automation_run_steps', new TableIndex({
        name: 'IDX_automation_run_steps_run',
        columnNames: ['run_id', 'created_at'],
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['automation_run_steps', 'automation_runs', 'automations']) {
      if (await queryRunner.hasTable(table)) await queryRunner.dropTable(table);
    }
  }
}
