import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La tabla de campañas: el correo escrito a mano que se manda a una lista.
 *
 * Guarda el texto que salió, a qué lista, a cuántos, quién lo mandó y cuándo. No es historial por
 * gusto: es la única comunicación del sistema que nadie pidió individualmente, y ante un reclamo
 * hay que poder responder con lo que de verdad se envió y no con lo que se recuerda.
 *
 * El recuento se fija al enviar y no se recalcula: la lista cambia cada día, y la pregunta que se
 * responde después es a cuántos les llegó entonces.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class CampanasDeCorreo1790000000162 implements MigrationInterface {
  name = 'CampanasDeCorreo1790000000162';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('email_campaigns')) return;

    await queryRunner.query(`
      CREATE TABLE email_campaigns (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        client_id CHAR(36) NULL,
        asunto VARCHAR(200) NOT NULL,
        cuerpo TEXT NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'draft',
        destinatarios INT NOT NULL DEFAULT 0,
        enviados INT NOT NULL DEFAULT 0,
        sent_at TIMESTAMP NULL,
        created_by CHAR(36) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX IDX_email_campaigns_org_client (organization_id, client_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('email_campaigns')) {
      await queryRunner.query('DROP TABLE email_campaigns');
    }
  }
}
