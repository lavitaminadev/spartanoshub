import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/** Evidencia mínima para listas manuales de destinatarios de encuestas. */
export class ProcedenciaDestinatariosEncuesta1790000000191 implements MigrationInterface {
  name = 'ProcedenciaDestinatariosEncuesta1790000000191';
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('surveys'))) return;
    if (!(await hayColumna(queryRunner, 'surveys', 'recipient_source'))) await queryRunner.query('ALTER TABLE surveys ADD COLUMN recipient_source VARCHAR(255) NULL');
    if (!(await hayColumna(queryRunner, 'surveys', 'recipient_basis'))) await queryRunner.query('ALTER TABLE surveys ADD COLUMN recipient_basis VARCHAR(500) NULL');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('surveys'))) return;
    for (const column of ['recipient_basis', 'recipient_source']) if (await hayColumna(queryRunner, 'surveys', column)) await queryRunner.query(`ALTER TABLE surveys DROP COLUMN ${column}`);
  }
}
