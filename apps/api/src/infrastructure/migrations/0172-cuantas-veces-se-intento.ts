import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * Cuántas veces se intentó contactar antes de cerrar la ficha.
 *
 * Es el único dato que no se puede deducir de nada de lo ya guardado, y sin él «nunca respondió»
 * admite dos lecturas opuestas —una llamada perdida o cinco intentos en tres días— que apuntan a
 * problemas distintos: la primera es seguimiento, la segunda es el origen del tráfico. Mientras
 * las dos se escriban igual, la pregunta de a quién le toca corregir no se puede responder.
 *
 * Se pide en **todos** los descartes y no solo en los motivos dudosos. Exigirlo en uno solo lo
 * encarece frente a los demás, y quien tiene veinte fichas que cerrar elige el motivo que no le
 * pregunta nada: los datos mejorarían de aspecto empeorando de contenido, y además mentirían
 * sobre el perfil, que es lo que se le reporta a la pauta.
 *
 * Nulo significa que la ficha se cerró antes de que esto existiera. Cero es una respuesta
 * distinta y legítima —descartar sin intentar es correcto cuando los datos vienen errados— y por
 * eso se guarda en vez de confundirse con la ausencia.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class CuantasVecesSeIntento1790000000172 implements MigrationInterface {
  name = 'CuantasVecesSeIntento1790000000172';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('leads'))) return;
    if (!(await hayColumna(queryRunner, 'leads', 'intentos_de_contacto'))) {
      await queryRunner.query('ALTER TABLE leads ADD COLUMN intentos_de_contacto TINYINT UNSIGNED NULL');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('leads'))) return;
    if (await hayColumna(queryRunner, 'leads', 'intentos_de_contacto')) {
      await queryRunner.query('ALTER TABLE leads DROP COLUMN intentos_de_contacto');
    }
  }
}
