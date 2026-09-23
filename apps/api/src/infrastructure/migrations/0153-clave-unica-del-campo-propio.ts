import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayIndice } from './helpers/catalogo';

/**
 * Deja una sola clave única en los campos propios: la que incluye la empresa.
 *
 * `0152` ya lo hace, pero una base donde corrió su versión anterior quedó con las dos. Aquélla
 * preguntaba por la vieja en la lista de índices que arma TypeORM, y ahí no estaba: `0137` la
 * creó como `UNIQUE KEY` dentro del `CREATE TABLE`, y esas llegan como restricción y no como
 * índice. La condición daba falso y el `DROP` se saltaba en silencio.
 *
 * Con la anterior en pie, dos empresas no pueden tener un campo con la misma clave: la segunda
 * se rechaza como duplicada aunque sea de otra empresa, que es justo lo que `0152` venía a
 * permitir. Sobre una base al día no cambia nada.
 */
export class ClaveUnicaDelCampoPropio1790000000153 implements MigrationInterface {
  name = 'ClaveUnicaDelCampoPropio1790000000153';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_field_definitions'))) return;
    if (!(await hayIndice(queryRunner, 'crm_field_definitions', 'UQ_crm_field_org_entity_key_client'))) {
      await queryRunner.query('CREATE UNIQUE INDEX UQ_crm_field_org_entity_key_client ON crm_field_definitions (organization_id, entity, field_key, client_scope)');
    }
    if (await hayIndice(queryRunner, 'crm_field_definitions', 'UQ_crm_field_org_entity_key')) {
      await queryRunner.query('DROP INDEX UQ_crm_field_org_entity_key ON crm_field_definitions');
    }
  }

  public async down(): Promise<void> {
    // No hay vuelta: la clave que retira es la que impedía el caso que el sistema ya permite.
  }
}
