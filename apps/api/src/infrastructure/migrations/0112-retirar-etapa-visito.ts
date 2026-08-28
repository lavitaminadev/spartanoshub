import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * «Visitó» sale del embudo comercial.
 *
 * Nació para separar al que agendó una visita del que efectivamente vino, y la distinción es
 * real. Pero en la práctica no se usó: el equipo cierra desde «Visita agendada» a «Negociación»
 * o a «Descartado», y la etapa intermedia quedó vacía —cero leads en producción al retirarla—.
 *
 * Una etapa que nadie usa no es neutra: alarga el embudo, obliga a decidir en cada movimiento si
 * corresponde pasar por ella, y **reparte el volumen que Meta necesita para aprender**. Con un
 * embudo más corto, cada etapa concentra más eventos y la señal que se le devuelve es más fuerte.
 *
 * Los que estuvieran en esa etapa pasan a «Negociación»: si alguien vino a visitar, el trato
 * seguía vivo. Mandarlos a «Visita agendada» sería retroceder un paso que sí ocurrió.
 */
export class RetirarEtapaVisito1756400000000 implements MigrationInterface {
  name = 'RetirarEtapaVisito1756400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /*
     * Primero se mueven los leads y después se estrecha la restricción.
     *
     * Al revés, la restricción rechazaría las filas que todavía están en la etapa que se retira y
     * el despliegue quedaría a medias, con la migración marcada como no aplicada.
     */
    await queryRunner.query(`
      UPDATE leads SET status = 'negotiation'
      WHERE domain = 'commercial' AND status = 'visited'
    `);

    /*
     * La restricción se reemplaza, no se edita: MariaDB no admite modificar un CHECK en sitio.
     * Se tolera que no exista porque hay bases que la recibieron por otra vía.
     */
    const existe = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.table_constraints
      WHERE table_schema = DATABASE() AND table_name = 'leads'
        AND constraint_name = 'CHK_leads_status_domain'
    `);
    if (Number(existe?.[0]?.n ?? 0) > 0) {
      await queryRunner.query('ALTER TABLE leads DROP CONSTRAINT CHK_leads_status_domain');
    }

    await queryRunner.query(`
      ALTER TABLE leads ADD CONSTRAINT CHK_leads_status_domain CHECK (
        (domain = 'audience'
          AND status IN ('new', 'reserved', 'attended', 'no_show', 'lost'))
        OR
        (domain = 'commercial'
          AND status IN ('new', 'contacted', 'quote_sent', 'meeting_scheduled',
                         'negotiation', 'won', 'lost'))
      )
    `);
  }

  /**
   * Se devuelve la etapa al catálogo, pero no los leads que la ocupaban.
   *
   * No se guardó cuáles eran, y adivinarlos a partir de «Negociación» movería también a los que
   * llegaron ahí por su cuenta. Volver atrás deja la etapa disponible; el histórico se queda como
   * está, que es lo honesto.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const existe = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.table_constraints
      WHERE table_schema = DATABASE() AND table_name = 'leads'
        AND constraint_name = 'CHK_leads_status_domain'
    `);
    if (Number(existe?.[0]?.n ?? 0) > 0) {
      await queryRunner.query('ALTER TABLE leads DROP CONSTRAINT CHK_leads_status_domain');
    }

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
}
