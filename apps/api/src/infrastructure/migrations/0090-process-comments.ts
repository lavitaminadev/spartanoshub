import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Bitácora de trabajo sobre piezas, sesiones y solicitudes.
 *
 * Lo único que se guardaba era la corrección: un pedido de cambio con su origen. No había dónde
 * dejar lo que se observa mientras se produce, así que esas decisiones vivían en conversaciones
 * fuera del sistema y no quedaban asociadas al trabajo.
 *
 * El índice va por sujeto y fecha porque la consulta que importa es siempre la misma: el hilo
 * completo de un trabajo, en orden cronológico.
 */
export class ProcessComments1726900010000 implements MigrationInterface {
  name = 'ProcessComments1726900010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('process_comments')) return;

    await queryRunner.createTable(new Table({
      name: 'process_comments',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'organization_id', type: 'varchar', length: '36' },
        { name: 'subject_type', type: 'varchar', length: '20' },
        { name: 'subject_id', type: 'varchar', length: '36' },
        { name: 'author_id', type: 'varchar', length: '36', isNullable: true },
        { name: 'author_role', type: 'varchar', length: '40', isNullable: true },
        { name: 'author_name', type: 'varchar', length: '120', isNullable: true },
        { name: 'body', type: 'text' },
        { name: 'visibility', type: 'varchar', length: '20', default: "'internal'" },
        { name: 'edited_at', type: 'timestamp', isNullable: true },
        { name: 'anonymized_at', type: 'timestamp', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createIndex('process_comments', new TableIndex({
      name: 'IDX_process_comment_subject',
      columnNames: ['organization_id', 'subject_type', 'subject_id', 'created_at'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('process_comments')) {
      await queryRunner.dropTable('process_comments');
    }
  }
}
