import { MigrationInterface, QueryRunner } from 'typeorm';

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

    await queryRunner.query(`ALTER TABLE crm_contacts MODIFY lead_id VARCHAR(36) NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_contacts'))) return;
    await queryRunner.query(`ALTER TABLE crm_contacts MODIFY lead_id VARCHAR(36) NULL`);
  }
}
