import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La lista de a quién se le puede escribir, y por qué.
 *
 * Tabla propia y no una columna en `leads` o `reservations` a propósito: quien reservó una mesa
 * dio su correo para que le confirmes la reserva, no para recibir promociones. Son dos permisos
 * distintos, y guardarlos juntos convierte una base de clientes en una lista de envío que nadie
 * autorizó. Desde acá se pueden **ver** los otros registros; a esta tabla solo entra quien puede
 * recibir campañas.
 *
 * Cada fila lleva su procedencia y el texto que la persona aceptó. Sin eso, el estado nace en
 * `pending` y no se le manda nada: «estaba en un Excel» no es una respuesta cuando hay que
 * demostrar el origen de una dirección.
 */
export class SuscriptoresDeCorreo1756700000000 implements MigrationInterface {
  name = 'SuscriptoresDeCorreo1756700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tablas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'email_subscribers'
    `);
    if (Number(tablas?.[0]?.n ?? 0) > 0) return;

    await queryRunner.query(`
      CREATE TABLE email_subscribers (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        client_id CHAR(36) NULL,
        email VARCHAR(190) NOT NULL,
        name VARCHAR(180) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        source VARCHAR(120) NOT NULL,
        source_detail VARCHAR(255) NULL,
        consent_at TIMESTAMP NULL,
        consent_text TEXT NULL,
        consent_ip VARCHAR(45) NULL,
        unsubscribed_at TIMESTAMP NULL,
        unsubscribe_token VARCHAR(64) NOT NULL,
        last_sent_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    /*
     * Una dirección por organización.
     *
     * La misma persona en dos filas recibiría la campaña dos veces, y podría estar suscrita en una
     * y de baja en la otra —lo que significa escribirle después de que pidió que no—. La
     * restricción lo impide en la base y no solo en el código.
     */
    await queryRunner.query(
      'ALTER TABLE email_subscribers ADD UNIQUE KEY UQ_email_subscribers_org_email (organization_id, email)',
    );

    // El token es la llave del enlace de baja: único, y consultado sin sesión.
    await queryRunner.query(
      'ALTER TABLE email_subscribers ADD UNIQUE KEY UQ_email_subscribers_token (unsubscribe_token)',
    );

    // La consulta de cada campaña: quién está suscrito en esta organización.
    await queryRunner.query(
      'CREATE INDEX IDX_email_subscribers_org_status ON email_subscribers (organization_id, status)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS email_subscribers');
  }
}
