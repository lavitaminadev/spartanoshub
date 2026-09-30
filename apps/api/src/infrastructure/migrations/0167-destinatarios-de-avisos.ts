import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Las casillas del equipo que reciben avisos, por local y por tipo de aviso.
 *
 * Antes vivían en un campo de texto del formulario de reservas: una sola lista que recibía todo,
 * repetida en cada formulario del mismo local y sin constancia de quién agregó cada dirección.
 *
 * No convierte lo antiguo. Las direcciones del formulario siguen recibiendo todos los avisos hasta
 * que se pasen aquí: mover a ciegas el correo de un trabajador a una tabla nueva, decidiendo por
 * él qué avisos quiere, sería peor que dejarlo donde está y a la vista.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class DestinatariosDeAvisos1790000000167 implements MigrationInterface {
  name = 'DestinatariosDeAvisos1790000000167';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('team_notification_recipients')) return;
    await queryRunner.query(`
      CREATE TABLE team_notification_recipients (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        client_id CHAR(36) NOT NULL,
        email VARCHAR(190) NOT NULL,
        name VARCHAR(120) NULL,
        cargo VARCHAR(80) NULL,
        tipos JSON NULL,
        created_by CHAR(36) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY UQ_team_recipients_org_client_email (organization_id, client_id, email),
        KEY IDX_team_recipients_org_client (organization_id, client_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('team_notification_recipients')) {
      await queryRunner.query('DROP TABLE team_notification_recipients');
    }
  }
}
