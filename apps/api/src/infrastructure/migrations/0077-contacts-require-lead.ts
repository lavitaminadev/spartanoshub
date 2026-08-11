import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

type SqlColumnDefinition = {
  columnType: string;
  charset: string | null;
  collation: string | null;
};

/**
 * Un contacto es el vinculo de una persona con una cuenta, y toda persona vive en `leads`.
 *
 * Los contactos flotantes -sin `lead_id`- solo podian entrar por los endpoints de alta que
 * ninguna pantalla usaba. Nadie los mostraba y ningun proceso los mantenia al dia: eran
 * registros que existian sin que nada dependiera de ellos, y que al mismo tiempo hacian
 * imposible afirmar que la identidad de una persona vive en un solo lugar.
 *
 * La restriccion se aplica despues de darles un lead a los que hubiera, de modo que la
 * migracion no pierda datos aunque encuentre filas viejas.
 */
export class ContactsRequireLead1726200000000 implements MigrationInterface {
  name = 'ContactsRequireLead1726200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_contacts'))) return;

    const sqlDefinition = await this.getLeadIdSqlDefinition(queryRunner);
    await this.ensureLeadColumn(queryRunner, sqlDefinition);

    // Recupera primero asociaciones de una ejecucion interrumpida. El segundo UPDATE tambien
    // evita duplicar un lead si ya existe una identidad inequivalente por la fuente.
    await this.linkExistingContacts(queryRunner, true);
    await this.linkExistingContacts(queryRunner, false);

    await queryRunner.query(`
      INSERT INTO leads (id, organization_id, client_id, name, email, phone, domain, source, status, fit_status, quality_score, created_at, updated_at)
      SELECT UUID(), c.organization_id, c.client_id, c.name, c.email, c.phone,
             CASE WHEN c.client_id IS NULL THEN 'commercial' ELSE 'audience' END,
             'contacto_migrado', 'new', 'review', 0, c.created_at, c.updated_at
      FROM crm_contacts c
      WHERE c.lead_id IS NULL
    `);

    await this.linkExistingContacts(queryRunner, true);

    // Si algo quedo sin pareja, la columna no se puede endurecer sin perder la fila. Fallar la
    // migracion es recuperable; borrar datos de personas no lo es.
    const [{ orphans }] = await queryRunner.query(
      `SELECT COUNT(*) AS orphans FROM crm_contacts WHERE lead_id IS NULL`,
    );
    if (Number(orphans) > 0) {
      throw new Error(`Quedan ${orphans} contactos sin lead: revisarlos a mano antes de continuar`);
    }

    const previousForeignKey = await this.findLeadForeignKey(queryRunner);
    if (previousForeignKey) await queryRunner.dropForeignKey('crm_contacts', previousForeignKey);

    try {
      // No usar changeColumn aqui: TypeORM elimina y agrega la columna cuando MariaDB reporta
      // UUID y una instalacion anterior dejo VARCHAR(36). MODIFY conserva todos los valores.
      await this.setLeadColumnNullability(queryRunner, sqlDefinition, false);
      await queryRunner.createForeignKey('crm_contacts', this.leadForeignKey(previousForeignKey, 'RESTRICT'));
    } catch (error) {
      await this.setLeadColumnNullability(queryRunner, sqlDefinition, true);
      await queryRunner.createForeignKey(
        'crm_contacts',
        previousForeignKey || this.leadForeignKey(undefined, 'SET NULL'),
      );
      throw error;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_contacts'))) return;
    const sqlDefinition = await this.getLeadIdSqlDefinition(queryRunner);

    if (!(await queryRunner.hasColumn('crm_contacts', 'lead_id'))) {
      throw new Error('No existe crm_contacts.lead_id para revertir la migracion');
    }

    const requiredForeignKey = await this.findLeadForeignKey(queryRunner);
    if (requiredForeignKey) await queryRunner.dropForeignKey('crm_contacts', requiredForeignKey);

    try {
      await this.setLeadColumnNullability(queryRunner, sqlDefinition, true);
      await queryRunner.createForeignKey('crm_contacts', this.leadForeignKey(requiredForeignKey, 'SET NULL'));
    } catch (error) {
      await this.setLeadColumnNullability(queryRunner, sqlDefinition, false);
      await queryRunner.createForeignKey(
        'crm_contacts',
        requiredForeignKey || this.leadForeignKey(undefined, 'RESTRICT'),
      );
      throw error;
    }
  }

  private async getLeadIdSqlDefinition(queryRunner: QueryRunner): Promise<SqlColumnDefinition> {
    const rows = await queryRunner.query(`
      SELECT COLUMN_TYPE AS columnType,
             CHARACTER_SET_NAME AS charset,
             COLLATION_NAME AS collation
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'leads'
        AND COLUMN_NAME = 'id'
    `);
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error('No se pudo leer la definicion SQL de leads.id');

    const definition = {
      columnType: String(row.columnType ?? row.COLUMN_TYPE ?? ''),
      charset: this.optionalString(row.charset ?? row.CHARACTER_SET_NAME),
      collation: this.optionalString(row.collation ?? row.COLLATION_NAME),
    };
    this.assertSafeSqlType(definition);
    return definition;
  }

  private async ensureLeadColumn(
    queryRunner: QueryRunner,
    definition: SqlColumnDefinition,
  ): Promise<void> {
    if (await queryRunner.hasColumn('crm_contacts', 'lead_id')) return;
    await queryRunner.query(
      `ALTER TABLE crm_contacts ADD lead_id ${this.renderSqlType(definition)} NULL`,
    );
  }

  private async linkExistingContacts(
    queryRunner: QueryRunner,
    onlyMigrated: boolean,
  ): Promise<void> {
    await queryRunner.query(`
      UPDATE crm_contacts c
      JOIN leads l
        ON l.organization_id = c.organization_id
       AND (l.client_id <=> c.client_id)
       AND l.name = c.name
       AND (l.email <=> c.email)
       AND (l.phone <=> c.phone)
       ${onlyMigrated ? "AND l.source = 'contacto_migrado'" : ''}
      SET c.lead_id = l.id
      WHERE c.lead_id IS NULL
    `);
  }

  private async setLeadColumnNullability(
    queryRunner: QueryRunner,
    definition: SqlColumnDefinition,
    isNullable: boolean,
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE crm_contacts MODIFY lead_id ${this.renderSqlType(definition)} ${isNullable ? 'NULL' : 'NOT NULL'}`,
    );
  }

  private renderSqlType(definition: SqlColumnDefinition): string {
    const charset = definition.charset ? ` CHARACTER SET ${definition.charset}` : '';
    const collation = definition.collation ? ` COLLATE ${definition.collation}` : '';
    return `${definition.columnType}${charset}${collation}`;
  }

  private assertSafeSqlType(definition: SqlColumnDefinition): void {
    const columnTypePattern = /^[a-z][a-z0-9_]*(?:\(\d+(?:,\d+)?\))?(?: unsigned)?$/i;
    const identifierPattern = /^[a-z][a-z0-9_]*$/i;

    if (!columnTypePattern.test(definition.columnType)) {
      throw new Error(`Tipo SQL inesperado para leads.id: ${definition.columnType || '(vacio)'}`);
    }
    if (definition.charset && !identifierPattern.test(definition.charset)) {
      throw new Error(`Charset SQL inesperado para leads.id: ${definition.charset}`);
    }
    if (definition.collation && !identifierPattern.test(definition.collation)) {
      throw new Error(`Collation SQL inesperada para leads.id: ${definition.collation}`);
    }
  }

  private optionalString(value: unknown): string | null {
    return value === null || value === undefined || value === '' ? null : String(value);
  }

  private async findLeadForeignKey(queryRunner: QueryRunner): Promise<TableForeignKey | undefined> {
    const table = await queryRunner.getTable('crm_contacts');
    return table?.foreignKeys.find((foreignKey) =>
      foreignKey.columnNames.length === 1
      && foreignKey.columnNames[0] === 'lead_id'
      && foreignKey.referencedTableName.split('.').pop() === 'leads',
    );
  }

  private leadForeignKey(previous: TableForeignKey | undefined, onDelete: 'RESTRICT' | 'SET NULL'): TableForeignKey {
    return new TableForeignKey({
      name: previous?.name || 'FK_crm_contacts_lead',
      columnNames: ['lead_id'],
      referencedTableName: 'leads',
      referencedColumnNames: ['id'],
      onDelete,
      onUpdate: previous?.onUpdate,
    });
  }
}
