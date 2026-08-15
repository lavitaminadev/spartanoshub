import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Precisión de milisegundos en la fecha de los comentarios.
 *
 * `timestamp` guarda hasta el segundo, así que dos comentarios escritos dentro del mismo segundo
 * empataban y el hilo los devolvía en cualquier orden. Un hilo de trabajo que se lee para
 * entender cómo se llegó a una decisión no puede tener el orden al azar, y el empate no es
 * hipotético: se dio al primer intento de escribir dos observaciones seguidas.
 *
 * El desempate por identificador no sirve acá porque son UUID aleatorios, sin relación con el
 * momento en que se creó la fila.
 */
export class CommentMillisecondPrecision1726900011000 implements MigrationInterface {
  name = 'CommentMillisecondPrecision1726900011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('process_comments'))) return;
    await queryRunner.query(
      'ALTER TABLE `process_comments` MODIFY `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('process_comments'))) return;
    await queryRunner.query(
      'ALTER TABLE `process_comments` MODIFY `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
  }
}
