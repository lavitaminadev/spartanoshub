import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna, hayIndice } from './helpers/catalogo';

/**
 * La baja del correo comercial pasa a ser por empresa, y deja constancia.
 *
 * Había una sola ficha por organización y dirección, asignada al primer local que la registró.
 * Con eso, quien reservaba en dos locales se daba de baja desde el correo de uno y quedaba fuera
 * de los dos, y el segundo probablemente no la alcanzaba nunca. Cada empresa es responsable
 * distinto de esos datos: el permiso se le dio a cada una por separado y la baja también lo es.
 *
 * Se agrega además la lista de exclusión, que guarda una huella del correo y no el correo. Es lo
 * que permite cumplir a la vez las dos exigencias que parecían incompatibles: el artículo 28 B de
 * la Ley 19.496 prohíbe volver a escribir a quien pidió la suspensión —hay que recordarlo— y la
 * Ley 21.719 da derecho a que le borren sus datos. De la huella no se vuelve a la dirección.
 *
 * Las fichas existentes no se tocan: conservan su empresa y su estado. Correrla dos veces no
 * cambia el resultado.
 */
export class BajaPorLocalYListaDeExclusion1790000000161 implements MigrationInterface {
  name = 'BajaPorLocalYListaDeExclusion1790000000161';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('email_subscribers')) {
      /*
       * El índice viejo impide dos fichas de la misma dirección en la organización, que es
       * justamente lo que ahora hace falta: una por local. Se reemplaza en vez de agregarse.
       *
       * MariaDB trata los nulos como distintos entre sí en un índice único, así que dos filas sin
       * empresa —la lista de la agencia— no chocarían. Eso ya lo impide el propio alta, que busca
       * por organización, empresa y correo antes de crear.
       */
      if (await hayIndice(queryRunner, 'email_subscribers', 'UQ_email_subscribers_org_email')) {
        await queryRunner.query('DROP INDEX UQ_email_subscribers_org_email ON email_subscribers');
      }
      if (!(await hayIndice(queryRunner, 'email_subscribers', 'UQ_email_subscribers_org_client_email'))) {
        await queryRunner.query('CREATE UNIQUE INDEX UQ_email_subscribers_org_client_email ON email_subscribers (organization_id, client_id, email)');
      }
      if (!(await hayColumna(queryRunner, 'email_subscribers', 'unsubscribed_scope'))) {
        await queryRunner.query("ALTER TABLE email_subscribers ADD COLUMN unsubscribed_scope VARCHAR(10) NULL");
      }
      if (!(await hayColumna(queryRunner, 'email_subscribers', 'unsubscribed_from'))) {
        await queryRunner.query('ALTER TABLE email_subscribers ADD COLUMN unsubscribed_from VARCHAR(80) NULL');
      }
      // Las bajas anteriores se marcan como de su propio local: es lo que de hecho ocurrió, aunque
      // entonces la ficha fuera una sola. Dejarlas sin alcance las volvería imposibles de explicar.
      await queryRunner.query("UPDATE email_subscribers SET unsubscribed_scope = 'local' WHERE status = 'unsubscribed' AND unsubscribed_at IS NOT NULL AND unsubscribed_scope IS NULL");
    }

    if (!(await queryRunner.hasTable('email_suppression'))) {
      await queryRunner.query(`
        CREATE TABLE email_suppression (
          id VARCHAR(36) NOT NULL,
          organization_id VARCHAR(36) NOT NULL,
          client_id VARCHAR(36) NULL,
          huella CHAR(64) NOT NULL,
          alcance VARCHAR(10) NOT NULL,
          origen VARCHAR(80) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY UQ_email_suppression_org_huella_client (organization_id, huella, client_id),
          INDEX IDX_email_suppression_org_huella (organization_id, huella)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('email_suppression')) await queryRunner.query('DROP TABLE email_suppression');
    if (!(await queryRunner.hasTable('email_subscribers'))) return;
    if (await hayColumna(queryRunner, 'email_subscribers', 'unsubscribed_from')) {
      await queryRunner.query('ALTER TABLE email_subscribers DROP COLUMN unsubscribed_from');
    }
    if (await hayColumna(queryRunner, 'email_subscribers', 'unsubscribed_scope')) {
      await queryRunner.query('ALTER TABLE email_subscribers DROP COLUMN unsubscribed_scope');
    }
    if (await hayIndice(queryRunner, 'email_subscribers', 'UQ_email_subscribers_org_client_email')) {
      await queryRunner.query('DROP INDEX UQ_email_subscribers_org_client_email ON email_subscribers');
    }
  }
}
