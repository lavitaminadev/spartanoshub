import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

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

    const previousForeignKey = await this.findLeadForeignKey(queryRunner);
    if (previousForeignKey) await queryRunner.dropForeignKey('crm_contacts', previousForeignKey);

    try {
      await queryRunner.query(`ALTER TABLE crm_contacts MODIFY lead_id VARCHAR(36) NOT NULL`);
      await queryRunner.createForeignKey('crm_contacts', this.leadForeignKey(previousForeignKey, 'RESTRICT'));
    } catch (error) {
      // MySQL confirma cada ALTER TABLE aunque la migracion use una transaccion. Restaurar la
      // nulabilidad y la relacion anterior evita dejar una tabla sin integridad referencial.
      await queryRunner.query(`ALTER TABLE crm_contacts MODIFY lead_id VARCHAR(36) NULL`);
      if (previousForeignKey) await queryRunner.createForeignKey('crm_contacts', previousForeignKey);
      throw error;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_contacts'))) return;
    const requiredForeignKey = await this.findLeadForeignKey(queryRunner);
    if (requiredForeignKey) await queryRunner.dropForeignKey('crm_contacts', requiredForeignKey);

    try {
      await queryRunner.query(`ALTER TABLE crm_contacts MODIFY lead_id VARCHAR(36) NULL`);
      await queryRunner.createForeignKey('crm_contacts', this.leadForeignKey(requiredForeignKey, 'SET NULL'));
    } catch (error) {
      await queryRunner.query(`ALTER TABLE crm_contacts MODIFY lead_id VARCHAR(36) NOT NULL`);
      if (requiredForeignKey) await queryRunner.createForeignKey('crm_contacts', requiredForeignKey);
      throw error;
    }
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
