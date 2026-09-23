import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Deja una sola clave única en los campos propios: la que incluye la empresa.
 *
 * `0152` tenía que retirar la anterior y no lo hacía. Preguntaba por ella en la lista de índices
 * que arma TypeORM, y ahí no estaba: `0137` la creó como `UNIQUE KEY` dentro del `CREATE TABLE`,
 * y esas llegan como restricción y no como índice. La condición daba falso y el `DROP` se
 * saltaba en silencio.
 *
 * Con la anterior en pie, dos empresas no pueden tener un campo con la misma clave: la segunda
 * se rechaza como duplicada aunque sea de otra empresa, que es justo lo que `0152` venía a
 * permitir. Acá se pregunta al catálogo, que no distingue entre una forma y la otra.
 */
export class ClaveUnicaDelCampoPropio1790000000153 implements MigrationInterface {
  name = 'ClaveUnicaDelCampoPropio1790000000153';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_field_definitions'))) return;

    /*
     * Primero la nueva y después el retiro de la vieja.
     *
     * Entre las dos sentencias la tabla queda un instante sin ninguna: en ese orden, sin la que
     * protege de verdad. Además, `organization_id` encabeza las dos, así que crear la nueva
     * antes le deja a InnoDB un índice donde sostener la clave foránea cuando la otra se va.
     */
    if (!(await this.existe(queryRunner, 'UQ_crm_field_org_entity_key_client'))) {
      await queryRunner.query('CREATE UNIQUE INDEX UQ_crm_field_org_entity_key_client ON crm_field_definitions (organization_id, entity, field_key, client_scope)');
    }
    if (await this.existe(queryRunner, 'UQ_crm_field_org_entity_key')) {
      await queryRunner.query('DROP INDEX UQ_crm_field_org_entity_key ON crm_field_definitions');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_field_definitions'))) return;
    if (!(await this.existe(queryRunner, 'UQ_crm_field_org_entity_key'))) {
      // Volver sólo es posible si no hay dos empresas usando ya la misma clave.
      await queryRunner.query('CREATE UNIQUE INDEX UQ_crm_field_org_entity_key ON crm_field_definitions (organization_id, entity, field_key)');
    }
  }

  /** Si la tabla tiene ese índice, preguntado al catálogo y no a la lectura de TypeORM. */
  private async existe(queryRunner: QueryRunner, indice: string): Promise<boolean> {
    const filas: Array<{ total: number }> = await queryRunner.query(
      `SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'crm_field_definitions' AND index_name = ?`,
      [indice],
    );
    return Number(filas[0]?.total ?? 0) > 0;
  }
}
