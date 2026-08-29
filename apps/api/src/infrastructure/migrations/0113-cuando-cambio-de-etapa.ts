import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cuándo cambió de etapa cada lead.
 *
 * Hacía falta para poder avisar de los que llevan días parados, y `updated_at` no sirve para eso:
 * se mueve con **cualquier** edición. Corregir un teléfono o añadir una nota reiniciaba el reloj,
 * de modo que el lead que más se manosea no avisaba nunca y el realmente olvidado tampoco si
 * alguien le tocó un dato. Justo al revés de lo que se necesita.
 *
 * El dato ya existía en `process_stage_changes`, que guarda cada cambio con su fecha. Esta columna
 * no lo inventa: lo copia. Es una desnormalización por velocidad —pintar un tablero de cien
 * tarjetas con una subconsulta por cada una son cien consultas— y por eso se rellena desde el
 * historial y no desde cero.
 *
 * Los leads sin historial —los anteriores a que se registrara, y los creados sin haber cambiado
 * nunca de etapa— toman su fecha de creación. Es la verdad para ellos: llevan parados en «Nuevo»
 * desde que entraron, y esa es exactamente la información que la alerta tiene que dar.
 */
export class CuandoCambioDeEtapa1756500000000 implements MigrationInterface {
  name = 'CuandoCambioDeEtapa1756500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'leads' AND column_name = 'stage_changed_at'
    `);
    if (Number(columnas?.[0]?.n ?? 0) > 0) return;

    await queryRunner.query('ALTER TABLE leads ADD COLUMN stage_changed_at TIMESTAMP NULL');

    /*
     * El último cambio registrado de cada lead.
     *
     * `subject_type = 'lead'` acota a los leads: la misma tabla guarda el recorrido de piezas y
     * de solicitudes, y sin el filtro un identificador repetido entre dominios traería la fecha
     * de otro proceso.
     */
    await queryRunner.query(`
      UPDATE leads l
      SET l.stage_changed_at = (
        SELECT MAX(c.created_at) FROM process_stage_changes c
        WHERE c.subject_type = 'lead' AND c.subject_id = l.id
      )
    `);

    // Los que nunca cambiaron de etapa llevan parados desde que entraron.
    await queryRunner.query('UPDATE leads SET stage_changed_at = created_at WHERE stage_changed_at IS NULL');

    /*
     * Hasta qué gravedad se avisó ya.
     *
     * Sin esto, el trabajo que revisa la cola avisaría del mismo lead en cada pasada: quien lo
     * lleva recibiría la misma notificación cada hora hasta moverlo, y aprendería a ignorarlas
     * todas —incluidas las de los leads que sí importan—.
     *
     * Se limpia al cambiar de etapa, porque un lead que avanzó y se vuelve a parar merece un
     * aviso nuevo.
     */
    await queryRunner.query('ALTER TABLE leads ADD COLUMN idle_alerted_level VARCHAR(10) NULL');

    // Las alertas preguntan «qué lleva parado» dentro de una organización, no de un lead: el
    // índice es el que evita recorrer la tabla entera en cada pasada del aviso.
    await queryRunner.query(
      'CREATE INDEX IDX_leads_org_stage_changed ON leads (organization_id, status, stage_changed_at)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'leads' AND column_name = 'stage_changed_at'
    `);
    if (Number(columnas?.[0]?.n ?? 0) === 0) return;

    await queryRunner.query('DROP INDEX IDX_leads_org_stage_changed ON leads');
    await queryRunner.query('ALTER TABLE leads DROP COLUMN idle_alerted_level');
    await queryRunner.query('ALTER TABLE leads DROP COLUMN stage_changed_at');
  }
}
