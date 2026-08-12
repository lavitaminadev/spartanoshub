import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Versiones del consentimiento informado (Ley 19.628).
 *
 * Guarda el texto exacto que cada persona aceptó. Sin el texto versionado, la aceptación
 * registrada en `users.terms_version` es un número que no se puede exhibir ante una consulta
 * del titular ni ante la autoridad.
 *
 * La versión vigente se sincroniza con el parámetro `compliance.terms_version`, que es lo que
 * ya decide si a alguien se le vuelve a pedir la aceptación al entrar. Publicar acá y no
 * tocar ese parámetro dejaría el texto nuevo sin efecto sobre nadie.
 */
export class ConsentVersions1726400200000 implements MigrationInterface {
  name = 'ConsentVersions1726400200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('consent_versions')) return;

    await queryRunner.createTable(new Table({
      name: 'consent_versions',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
        { name: 'organization_id', type: 'varchar', length: '36' },
        { name: 'version', type: 'int' },
        { name: 'title', type: 'varchar', length: '200' },
        { name: 'text', type: 'text' },
        { name: 'published_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'published_by', type: 'varchar', length: '36', isNullable: true },
        { name: 'active', type: 'boolean', default: false },
      ],
    }), true);

    // El número de versión es la identidad del texto dentro de la organización: repetirlo
    // haría ambigua la aceptación guardada en `users.terms_version`.
    await queryRunner.createIndex('consent_versions', new TableIndex({
      name: 'UQ_consent_version_number',
      columnNames: ['organization_id', 'version'],
      isUnique: true,
    }));

    // La consulta más frecuente es "cuál es el texto vigente".
    await queryRunner.createIndex('consent_versions', new TableIndex({
      name: 'IDX_consent_version_active',
      columnNames: ['organization_id', 'active'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('consent_versions'))) return;
    await queryRunner.dropTable('consent_versions');
  }
}
