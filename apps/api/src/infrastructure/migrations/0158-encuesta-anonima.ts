import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * Interruptor de respuestas anónimas en una encuesta.
 *
 * Nace apagado para no cambiar ninguna encuesta existente: lo que hoy se responde identificado
 * sigue igual hasta que alguien lo active. Correrla dos veces no cambia nada.
 */
export class EncuestaAnonima1790000000158 implements MigrationInterface {
  name = 'EncuestaAnonima1790000000158';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('surveys'))) return;
    if (await hayColumna(queryRunner, 'surveys', 'anonymous')) return;
    await queryRunner.query('ALTER TABLE surveys ADD COLUMN anonymous TINYINT(1) NOT NULL DEFAULT 0');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('surveys') && await hayColumna(queryRunner, 'surveys', 'anonymous')) {
      await queryRunner.query('ALTER TABLE surveys DROP COLUMN anonymous');
    }
  }
}
