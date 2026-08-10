import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Solicitudes de trabajo: la puerta de entrada única a producción.
 *
 * Separada de `pieces` porque son cosas distintas: una solicitud puede convertirse en varias
 * piezas, puede rechazarse sin llegar a ser ninguna, y conserva lo que pidió quien la abrió
 * aunque la pieza después pase por cinco estados.
 *
 * Los campos por área van en JSON para que cada área los defina y los cambie sin migración. Lo
 * común —cliente, plazo, prioridad, responsable— sí son columnas, porque se filtra y se ordena
 * por ellas y un JSON no se indexa igual.
 */
export class WorkRequests1726100000000 implements MigrationInterface {
  name = 'WorkRequests1726100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('work_requests')) return;

    await queryRunner.createTable(new Table({
      name: 'work_requests',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'organization_id', type: 'varchar', length: '36' },
        { name: 'client_id', type: 'varchar', length: '36' },
        { name: 'code', type: 'varchar', length: '20' },
        { name: 'area', type: 'varchar', length: '30' },
        { name: 'title', type: 'varchar', length: '200' },
        { name: 'description', type: 'text', isNullable: true },
        { name: 'priority', type: 'varchar', length: '20', default: "'normal'" },
        { name: 'status', type: 'varchar', length: '20', default: "'new'" },
        { name: 'needed_by', type: 'date', isNullable: true },
        { name: 'requested_by', type: 'varchar', length: '36' },
        { name: 'assigned_to', type: 'varchar', length: '36', isNullable: true },
        { name: 'creative_fields', type: 'json', isNullable: true },
        { name: 'operational_fields', type: 'json', isNullable: true },
        { name: 'rejection_reason', type: 'varchar', length: '500', isNullable: true },
        // El resultado de convertir depende del área y no es intercambiable: diseño produce
        // piezas gráficas, audiovisual produce una sesión de rodaje. Van en columnas distintas
        // para que no haya que mirar el área para saber qué es cada identificador.
        { name: 'piece_ids', type: 'json', isNullable: true },
        { name: 'session_id', type: 'varchar', length: '36', isNullable: true },
        { name: 'reviewed_at', type: 'timestamp', isNullable: true },
        { name: 'resolved_at', type: 'timestamp', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    // El correlativo se genera por organización, así que el índice único incluye ambos: sin él,
    // dos solicitudes creadas en el mismo instante pueden compartir código.
    await queryRunner.createIndex('work_requests', new TableIndex({
      name: 'UQ_work_requests_org_code', columnNames: ['organization_id', 'code'], isUnique: true,
    }));
    // Los tres accesos reales a esta tabla: la bandeja por estado, la vista de una cuenta y
    // "lo mío" de cada persona.
    await queryRunner.createIndex('work_requests', new TableIndex({
      name: 'IDX_work_requests_org_status', columnNames: ['organization_id', 'status', 'created_at'],
    }));
    await queryRunner.createIndex('work_requests', new TableIndex({
      name: 'IDX_work_requests_org_client', columnNames: ['organization_id', 'client_id'],
    }));
    await queryRunner.createIndex('work_requests', new TableIndex({
      name: 'IDX_work_requests_assignee', columnNames: ['organization_id', 'assigned_to'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('work_requests')) await queryRunner.dropTable('work_requests');
  }
}
