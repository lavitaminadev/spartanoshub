import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * Desde cuándo estaba prohibido escribirle, que no es lo mismo que cuándo lo anotamos.
 *
 * La tabla guardaba una sola fecha, `created_at`, y servía para una sola pregunta: cuándo
 * aplicamos la exclusión. Es la fecha que demuestra diligencia, y hay que conservarla.
 *
 * Pero la que decide si hubo infracción es otra. El reglamento del Sistema No Molestar —Decreto 62
 * de 2019 del Ministerio de Economía, art. 5— prohíbe el envío **desde el momento en que la
 * persona registra la solicitud**, y el aviso al proveedor recién sale el día hábil siguiente
 * (art. 4). Su inciso 2 agrega que, si lo pidió por el Sistema y también directamente a la
 * empresa, rige «lo que primero ocurra». Con una sola fecha no se puede sostener ninguna de las
 * dos cosas: un correo enviado el día intermedio parecía lícito y no lo era.
 *
 * Queda nula para todo lo ya anotado, y nula significa «coincide con `created_at`». No se rellena
 * hacia atrás restando un día: inventar la fecha que decide una infracción es peor que no tenerla.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class FechaEnQueLaPidieron1790000000171 implements MigrationInterface {
  name = 'FechaEnQueLaPidieron1790000000171';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('email_suppression'))) return;
    if (!(await hayColumna(queryRunner, 'email_suppression', 'pedida_el'))) {
      await queryRunner.query('ALTER TABLE email_suppression ADD COLUMN pedida_el DATETIME NULL');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('email_suppression'))) return;
    if (await hayColumna(queryRunner, 'email_suppression', 'pedida_el')) {
      await queryRunner.query('ALTER TABLE email_suppression DROP COLUMN pedida_el');
    }
  }
}
