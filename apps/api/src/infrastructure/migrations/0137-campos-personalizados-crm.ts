import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Campos propios del CRM, definidos desde la pantalla y no desde una migración.
 *
 * Hasta acá agregar «canal preferido» a un lead era cambiar la base, compilar y desplegar. Con
 * esto, la definición es un dato y el valor vive en una columna aparte.
 *
 * **Por qué una columna nueva y no `leads.metadata`.** Esa columna ya guarda las respuestas de los
 * formularios de Meta, la atribución del clic, las señales de scoring y los conflictos de
 * identidad, y **se fusiona sola en cada reingreso**. Un campo propio con el mismo nombre que una
 * pregunta de Meta se habría sobrescrito en silencio la siguiente vez que Meta reenviara el lead.
 *
 * **Qué pasa con los datos existentes: nada.** Las tres tablas reciben una columna nula; ninguna
 * fila se reescribe y ninguna columna actual cambia. En MariaDB agregar una columna nula al final
 * no reconstruye la tabla ni la bloquea. La tabla de definiciones es nueva y empieza vacía.
 *
 * Los valores se guardan por `key` estable, nunca por etiqueta: renombrar «Canal» a «Canal
 * preferido» no toca un solo valor guardado.
 */
export class CamposPersonalizadosCrm1758900000000 implements MigrationInterface {
  name = 'CamposPersonalizadosCrm1758900000000';

  private static readonly TABLAS = ['leads', 'crm_contacts', 'crm_opportunities'];

  private async existe(queryRunner: QueryRunner, tabla: string, columna: string): Promise<boolean> {
    const rows = await queryRunner.query(
      'SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
      [tabla, columna],
    );
    return Number(rows?.[0]?.n ?? 0) > 0;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_field_definitions'))) {
      await queryRunner.query(`
        CREATE TABLE crm_field_definitions (
          id uuid NOT NULL,
          organization_id uuid NOT NULL,
          entity varchar(20) NOT NULL,
          field_key varchar(40) NOT NULL,
          label varchar(80) NOT NULL,
          type varchar(20) NOT NULL,
          options json NULL,
          required tinyint(1) NOT NULL DEFAULT 0,
          position int NOT NULL DEFAULT 0,
          archived_at timestamp NULL,
          created_by uuid NULL,
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY UQ_crm_field_org_entity_key (organization_id, entity, field_key),
          KEY IDX_crm_field_org_entity (organization_id, entity, archived_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }
    for (const tabla of CamposPersonalizadosCrm1758900000000.TABLAS) {
      if (await this.existe(queryRunner, tabla, 'custom_fields')) continue;
      await queryRunner.query(`ALTER TABLE ${tabla} ADD COLUMN custom_fields json NULL`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of CamposPersonalizadosCrm1758900000000.TABLAS) {
      if (!(await this.existe(queryRunner, tabla, 'custom_fields'))) continue;
      await queryRunner.query(`ALTER TABLE ${tabla} DROP COLUMN custom_fields`);
    }
    if (await queryRunner.hasTable('crm_field_definitions')) await queryRunner.query('DROP TABLE crm_field_definitions');
  }
}
