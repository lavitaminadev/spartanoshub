import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Libro de registro de vulneraciones de seguridad (`security_incidents`).
 *
 * Guarda qué pasó, cuándo se detectó, qué datos y de cuántas personas, qué empresas, qué se hizo y
 * las dos fechas de aviso —al local y a la Agencia—. De `detected_at` corre el plazo de aviso al local.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class RegistroDeVulneraciones1790000000185 implements MigrationInterface {
  name = 'RegistroDeVulneraciones1790000000185';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('security_incidents')) return;
    await queryRunner.query(`
      CREATE TABLE security_incidents (
        id CHAR(36) NOT NULL,
        organization_id CHAR(36) NOT NULL,
        descripcion TEXT NOT NULL,
        detected_at DATETIME NOT NULL,
        datos_afectados TEXT NOT NULL,
        titulares_afectados INT NULL,
        client_ids JSON NOT NULL,
        medidas TEXT NULL,
        aviso_local_at DATETIME NULL,
        aviso_agencia_at DATETIME NULL,
        created_by CHAR(36) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        INDEX IDX_security_incidents_org_detected (organization_id, detected_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('security_incidents')) await queryRunner.query('DROP TABLE security_incidents');
  }
}
