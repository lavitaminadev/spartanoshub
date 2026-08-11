import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

/**
 * Un contacto es el vínculo de una persona con una cuenta, y toda persona vive en `leads`.
 *
 * Los contactos flotantes —sin `lead_id`— solo podían entrar por los endpoints de alta que
 * ninguna pantalla usaba. Nadie los mostraba y ningún proceso los mantenía al día: eran
 * registros que existían sin que nada dependiera de ellos, y que al mismo tiempo hacían
 * imposible afirmar que la identidad de una persona vive en un solo lugar.
 *
 * La restricción se aplica después de darles un lead a los que hubiera, de modo que la
 * migración no pierda datos aunque encuentre filas viejas.
 */
export class ContactsRequireLead1726200000000 implements MigrationInterface {
  name = 'ContactsRequireLead1726200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_contacts'))) return;

    // Un contacto huérfano lleva datos de una persona real: se le crea su lead en vez de
    // borrarlo. El dominio se deduce de si pertenece a una cuenta —audiencia de un local— o
    // no —contacto de una empresa prospecto—, que es la misma regla que usa la captura.
    await queryRunner.query(`
      INSERT INTO leads (id, organization_id, client_id, name, email, phone, domain, source, status, fit_status, quality_score, created_at, updated_at)
      SELECT UUID(), c.organization_id, c.client_id, c.name, c.email, c.phone,
             CASE WHEN c.client_id IS NULL THEN 'commercial' ELSE 'audience' END,
             'contacto_migrado', 'new', 'review', 0, c.created_at, c.updated_at
      FROM crm_contacts c
      WHERE c.lead_id IS NULL
    `);

    await queryRunner.query(`
      UPDATE crm_contacts c
      JOIN leads l
        ON l.organization_id = c.organization_id
       AND l.source = 'contacto_migrado'
       AND l.name = c.name
       AND (l.email <=> c.email)
       AND (l.phone <=> c.phone)
      SET c.lead_id = l.id
      WHERE c.lead_id IS NULL
    `);

    // Si algo quedó sin pareja, la columna no se puede endurecer sin perder la fila. Se corta
    // acá: fallar la migración es recuperable, borrar datos de personas no lo es.
    const [{ orphans }] = await queryRunner.query(
      `SELECT COUNT(*) AS orphans FROM crm_contacts WHERE lead_id IS NULL`,
    );
    if (Number(orphans) > 0) {
      throw new Error(`Quedan ${orphans} contactos sin lead: revisarlos a mano antes de continuar`);
    }

    const {
      contactLeadColumn,
      referencedLeadColumn,
      foreignKey: previousForeignKey,
    } = await this.getLeadSchema(queryRunner);
    if (previousForeignKey) await queryRunner.dropForeignKey('crm_contacts', previousForeignKey);

    const requiredColumn = this.compatibleLeadColumn(contactLeadColumn, referencedLeadColumn, false);
    const nullableColumn = this.compatibleLeadColumn(contactLeadColumn, referencedLeadColumn, true);
    let columnChanged = false;

    try {
      await queryRunner.changeColumn('crm_contacts', contactLeadColumn, requiredColumn);
      columnChanged = true;
      await queryRunner.createForeignKey('crm_contacts', this.leadForeignKey(previousForeignKey, 'RESTRICT'));
    } catch (error) {
      // MySQL confirma cada ALTER TABLE aunque la migracion use una transaccion. La columna
      // compatible tambien repara una ejecucion anterior que haya perdido cotejamiento o FK.
      if (columnChanged) {
        await queryRunner.changeColumn('crm_contacts', requiredColumn, nullableColumn);
      }
      await queryRunner.createForeignKey(
        'crm_contacts',
        previousForeignKey || this.leadForeignKey(undefined, 'SET NULL'),
      );
      throw error;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_contacts'))) return;
    const {
      contactLeadColumn,
      referencedLeadColumn,
      foreignKey: requiredForeignKey,
    } = await this.getLeadSchema(queryRunner);
    if (requiredForeignKey) await queryRunner.dropForeignKey('crm_contacts', requiredForeignKey);

    const nullableColumn = this.compatibleLeadColumn(contactLeadColumn, referencedLeadColumn, true);
    const requiredColumn = this.compatibleLeadColumn(contactLeadColumn, referencedLeadColumn, false);
    let columnChanged = false;

    try {
      await queryRunner.changeColumn('crm_contacts', contactLeadColumn, nullableColumn);
      columnChanged = true;
      await queryRunner.createForeignKey('crm_contacts', this.leadForeignKey(requiredForeignKey, 'SET NULL'));
    } catch (error) {
      if (columnChanged) {
        await queryRunner.changeColumn('crm_contacts', nullableColumn, requiredColumn);
      }
      await queryRunner.createForeignKey(
        'crm_contacts',
        requiredForeignKey || this.leadForeignKey(undefined, 'RESTRICT'),
      );
      throw error;
    }
  }

  private async getLeadSchema(queryRunner: QueryRunner): Promise<{
    contactLeadColumn: TableColumn;
    referencedLeadColumn: TableColumn;
    foreignKey: TableForeignKey | undefined;
  }> {
    const [contactsTable, leadsTable] = await Promise.all([
      queryRunner.getTable('crm_contacts'),
      queryRunner.getTable('leads'),
    ]);
    const contactLeadColumn = contactsTable?.findColumnByName('lead_id');
    const referencedLeadColumn = leadsTable?.findColumnByName('id');

    if (!contactLeadColumn || !referencedLeadColumn) {
      throw new Error('No se pudo leer crm_contacts.lead_id o leads.id para validar su compatibilidad');
    }

    const foreignKey = contactsTable?.foreignKeys.find((candidate) =>
      candidate.columnNames.length === 1
      && candidate.columnNames[0] === 'lead_id'
      && candidate.referencedTableName.split('.').pop() === 'leads',
    );

    return { contactLeadColumn, referencedLeadColumn, foreignKey };
  }

  private compatibleLeadColumn(
    current: TableColumn,
    referenced: TableColumn,
    isNullable: boolean,
  ): TableColumn {
    const compatible = current.clone();

    // Una FK MySQL exige que ambos lados coincidan tambien en longitud, unsigned y cotejamiento.
    compatible.type = referenced.type;
    compatible.length = referenced.length;
    compatible.width = referenced.width;
    compatible.charset = referenced.charset;
    compatible.collation = referenced.collation;
    compatible.precision = referenced.precision;
    compatible.scale = referenced.scale;
    compatible.zerofill = referenced.zerofill;
    compatible.unsigned = referenced.unsigned;
    compatible.enum = referenced.enum ? [...referenced.enum] : undefined;
    compatible.enumName = referenced.enumName;
    compatible.spatialFeatureType = referenced.spatialFeatureType;
    compatible.srid = referenced.srid;
    compatible.isNullable = isNullable;

    return compatible;
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
