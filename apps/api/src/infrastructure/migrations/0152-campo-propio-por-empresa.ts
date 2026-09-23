import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * De qué empresa es cada campo propio del CRM.
 *
 * Un campo se definía para toda la organización, así que el que una empresa necesitaba aparecía
 * en las fichas de todas: pantallas llenas de datos que a esa empresa no le dicen nada, y un
 * campo obligatorio de una bloqueando el guardado de otra.
 *
 * Vacío significa «de todas las empresas», que es lo que hacen los que ya existen: nadie pierde
 * un campo con esta migración. La clave única incluye la empresa mediante una columna espejo,
 * porque MySQL trata cada NULL como distinto y sin ella dos campos generales con la misma clave
 * podrían convivir.
 */
export class CampoPropioPorEmpresa1790000000152 implements MigrationInterface {
  name = 'CampoPropioPorEmpresa1790000000152';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_field_definitions'))) return;
    const tabla = await queryRunner.getTable('crm_field_definitions');

    if (!tabla?.findColumnByName('client_id')) {
      await queryRunner.addColumn('crm_field_definitions', new TableColumn({ name: 'client_id', type: 'varchar', length: '36', isNullable: true }));
    }
    if (!tabla?.findColumnByName('client_scope')) {
      await queryRunner.query('ALTER TABLE crm_field_definitions ADD COLUMN client_scope VARCHAR(36) AS (COALESCE(client_id, \'*\')) STORED');
    }

    const indices = (await queryRunner.getTable('crm_field_definitions'))?.indices ?? [];
    if (indices.some((indice) => indice.name === 'UQ_crm_field_org_entity_key')) {
      await queryRunner.query('DROP INDEX UQ_crm_field_org_entity_key ON crm_field_definitions');
    }
    if (!indices.some((indice) => indice.name === 'UQ_crm_field_org_entity_key_client')) {
      await queryRunner.query('CREATE UNIQUE INDEX UQ_crm_field_org_entity_key_client ON crm_field_definitions (organization_id, entity, field_key, client_scope)');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_field_definitions'))) return;
    const tabla = await queryRunner.getTable('crm_field_definitions');
    const indices = tabla?.indices ?? [];
    if (indices.some((indice) => indice.name === 'UQ_crm_field_org_entity_key_client')) {
      await queryRunner.query('DROP INDEX UQ_crm_field_org_entity_key_client ON crm_field_definitions');
    }
    // Los campos de una empresa concreta se pierden al volver: antes no cabían.
    await queryRunner.query('DELETE FROM crm_field_definitions WHERE client_id IS NOT NULL');
    if (tabla?.findColumnByName('client_scope')) await queryRunner.query('ALTER TABLE crm_field_definitions DROP COLUMN client_scope');
    if (tabla?.findColumnByName('client_id')) await queryRunner.dropColumn('crm_field_definitions', 'client_id');
    await queryRunner.query('CREATE UNIQUE INDEX UQ_crm_field_org_entity_key ON crm_field_definitions (organization_id, entity, field_key)');
  }
}
