import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gobierno legal independiente por empresa y libro inmutable de versiones/aceptaciones.
 * Las columnas históricas de `clients` se conservan como proyección compatible mientras
 * Reservas y Encuestas migran al servicio central.
 */
export class GobiernoLegalVersionado1790000000190 implements MigrationInterface {
  name = 'GobiernoLegalVersionado1790000000190';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('legal_document_versions'))) await queryRunner.query(`
      CREATE TABLE legal_document_versions (
        id VARCHAR(36) NOT NULL,
        organization_id VARCHAR(36) NOT NULL,
        client_id VARCHAR(36) NOT NULL,
        document_type VARCHAR(40) NOT NULL,
        version_number INT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'published',
        content JSON NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        change_summary VARCHAR(500) NULL,
        created_by VARCHAR(36) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        effective_from DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY UQ_legal_document_version (client_id, document_type, version_number),
        INDEX IDX_legal_document_current (organization_id, client_id, document_type, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    if (!(await queryRunner.hasTable('legal_acceptance_events'))) await queryRunner.query(`
      CREATE TABLE legal_acceptance_events (
        id VARCHAR(36) NOT NULL,
        organization_id VARCHAR(36) NOT NULL,
        client_id VARCHAR(36) NOT NULL,
        document_type VARCHAR(40) NOT NULL,
        document_version VARCHAR(40) NOT NULL,
        document_hash VARCHAR(64) NULL,
        actor_id VARCHAR(36) NULL,
        actor_name VARCHAR(180) NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(500) NULL,
        accepted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        INDEX IDX_legal_acceptance_client (organization_id, client_id, accepted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    if (!(await queryRunner.hasTable('legal_activation_events'))) await queryRunner.query(`
      CREATE TABLE legal_activation_events (
        id VARCHAR(36) NOT NULL,
        organization_id VARCHAR(36) NOT NULL,
        client_id VARCHAR(36) NOT NULL,
        action VARCHAR(20) NOT NULL,
        actor_id VARCHAR(36) NULL,
        reason VARCHAR(500) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        INDEX IDX_legal_activation_client (organization_id, client_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // El estado anterior se conserva como primera versión; la migración no cambia lo publicado.
    await queryRunner.query(`
      INSERT INTO legal_document_versions (id, organization_id, client_id, document_type, version_number, status, content, content_hash, change_summary, created_by, created_at, effective_from)
      SELECT UUID(), organization_id, id, 'identity', 1, 'published',
        JSON_OBJECT('legalName', legal_name, 'taxId', tax_id, 'privacyEmail', privacy_email),
        SHA2(CONCAT_WS('|', COALESCE(legal_name,''), COALESCE(tax_id,''), COALESCE(privacy_email,'')), 256),
        'Estado existente migrado al registro versionado', NULL, NOW(6), NOW(6)
      FROM clients c
      WHERE (legal_name IS NOT NULL OR tax_id IS NOT NULL OR privacy_email IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM legal_document_versions v WHERE v.client_id = c.id AND v.document_type = 'identity')
    `);
    await queryRunner.query(`
      INSERT INTO legal_document_versions (id, organization_id, client_id, document_type, version_number, status, content, content_hash, change_summary, created_by, created_at, effective_from)
      SELECT UUID(), organization_id, id, 'privacy', 1, 'published',
        JSON_OBJECT('mode', COALESCE(legal_mode,'enlace'), 'url', privacy_url, 'text', privacy_text),
        SHA2(CONCAT_WS('|', COALESCE(legal_mode,'enlace'), COALESCE(privacy_url,''), COALESCE(privacy_text,'')), 256),
        'Estado existente migrado al registro versionado', NULL, NOW(6), NOW(6)
      FROM clients c
      WHERE (privacy_url IS NOT NULL OR privacy_text IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM legal_document_versions v WHERE v.client_id = c.id AND v.document_type = 'privacy')
    `);
    await queryRunner.query(`
      INSERT INTO legal_document_versions (id, organization_id, client_id, document_type, version_number, status, content, content_hash, change_summary, created_by, created_at, effective_from)
      SELECT UUID(), organization_id, id, 'terms', 1, 'published',
        JSON_OBJECT('mode', COALESCE(legal_mode,'enlace'), 'url', terms_url, 'text', terms_text),
        SHA2(CONCAT_WS('|', COALESCE(legal_mode,'enlace'), COALESCE(terms_url,''), COALESCE(terms_text,'')), 256),
        'Estado existente migrado al registro versionado', NULL, NOW(6), NOW(6)
      FROM clients c
      WHERE (terms_url IS NOT NULL OR terms_text IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM legal_document_versions v WHERE v.client_id = c.id AND v.document_type = 'terms')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['legal_activation_events', 'legal_acceptance_events', 'legal_document_versions']) {
      if (await queryRunner.hasTable(table)) await queryRunner.query(`DROP TABLE ${table}`);
    }
  }
}
