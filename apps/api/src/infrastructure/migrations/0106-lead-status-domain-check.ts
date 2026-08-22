import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Un lead no puede quedar en un estado que su embudo no admite.
 *
 * La regla existía en el código —`isStatusInDomain`— y protegía la puerta por la que pasa el
 * equipo. Pero un lead puede llegar por otras: una importación antigua, la integración de Meta,
 * un `UPDATE` a mano para arreglar algo. Por alguna de esas se coló un contacto de campaña en
 * estado `won`, que pertenece al embudo comercial.
 *
 * El efecto es peor que un error: el lead **no tiene columna donde dibujarse**, así que
 * desaparece de la pantalla sin haberse borrado. Nadie lo echa de menos porque nadie sabe que
 * estaba, y sigue contando en los totales de la base.
 *
 * Esta migración hace dos cosas:
 *
 * 1. **Devuelve al redil lo que ya se salió.** Un contacto de campaña marcado como vendido pasa
 *    a `attended`: si se cerró una venta con él, es que vino. Cualquier otro estado comercial
 *    sobre un contacto de campaña pasa a `new`, que es de donde nunca debió moverse. En el
 *    sentido contrario —un prospecto de la agencia con estado del ciclo de reserva— se usa el
 *    mismo criterio.
 * 2. **Impide que vuelva a ocurrir**, con una restricción en la propia tabla. A partir de acá
 *    da igual por dónde entre el dato: la base lo rechaza.
 */
export class LeadStatusDomainCheck1756000001000 implements MigrationInterface {
  name = 'LeadStatusDomainCheck1756000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Un contacto de campaña marcado como vendido sí estuvo en el local: se conserva esa parte.
    await queryRunner.query(`
      UPDATE leads SET status = 'attended'
      WHERE domain = 'audience' AND status = 'won'
    `);
    // El resto de estados comerciales sobre un contacto de campaña no dicen nada de su visita.
    await queryRunner.query(`
      UPDATE leads SET status = 'new'
      WHERE domain = 'audience'
        AND status NOT IN ('new', 'reserved', 'attended', 'no_show', 'lost')
    `);
    // Y al revés: un prospecto de la agencia con estado del ciclo de reserva.
    await queryRunner.query(`
      UPDATE leads SET status = 'new'
      WHERE domain = 'commercial'
        AND status NOT IN ('new', 'contacted', 'quote_sent', 'meeting_scheduled',
                           'visited', 'negotiation', 'won', 'lost')
    `);

    /*
     * La restricción se declara sin nombre reservado y tolerando que ya exista: esta migración
     * puede correr sobre bases que la recibieron por otra vía, y fallar ahí dejaría el despliegue
     * a medias por algo que ya estaba bien.
     */
    const existe = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.table_constraints
      WHERE table_schema = DATABASE() AND table_name = 'leads'
        AND constraint_name = 'CHK_leads_status_domain'
    `);
    if (Number(existe?.[0]?.n ?? 0) > 0) return;

    await queryRunner.query(`
      ALTER TABLE leads ADD CONSTRAINT CHK_leads_status_domain CHECK (
        (domain = 'audience'
          AND status IN ('new', 'reserved', 'attended', 'no_show', 'lost'))
        OR
        (domain = 'commercial'
          AND status IN ('new', 'contacted', 'quote_sent', 'meeting_scheduled',
                         'visited', 'negotiation', 'won', 'lost'))
      )
    `);
  }

  /**
   * Solo se quita la restricción.
   *
   * Los estados corregidos no se deshacen: no se guardó cuál era el valor anterior, y aunque se
   * hubiera guardado, devolver un lead a un estado que su embudo no admite sería reintroducir a
   * propósito el problema que esta migración existe para cerrar.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const existe = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.table_constraints
      WHERE table_schema = DATABASE() AND table_name = 'leads'
        AND constraint_name = 'CHK_leads_status_domain'
    `);
    if (Number(existe?.[0]?.n ?? 0) === 0) return;
    await queryRunner.query('ALTER TABLE leads DROP CONSTRAINT CHK_leads_status_domain');
  }
}
