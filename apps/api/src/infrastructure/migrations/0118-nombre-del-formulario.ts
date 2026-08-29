import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El nombre del formulario sale de `metadata` y pasa a tener columna propia.
 *
 * Se guardaba dentro del JSON con el resto del contexto del origen, y ahí sirve para leerlo en la
 * ficha pero no para filtrar: preguntar «enséñame los leads del formulario de inversión» obliga a
 * recorrer la tabla entera extrayendo una clave de cada JSON, porque un índice sobre una columna
 * JSON no cubre una búsqueda dentro de ella.
 *
 * Es el único dato del `metadata` que se promueve. Los demás —ciudad, género, estado civil— se
 * leen de a uno cuando alguien abre una ficha, y no hay ninguna pantalla que agrupe por ellos.
 *
 * El valor existente se copia; no se pierde nada ni hay que reimportar.
 */
export class NombreDelFormulario1757000000000 implements MigrationInterface {
  name = 'NombreDelFormulario1757000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'leads' AND column_name = 'external_form_name'
    `);
    if (Number(columnas?.[0]?.n ?? 0) > 0) return;

    await queryRunner.query('ALTER TABLE leads ADD COLUMN external_form_name VARCHAR(255) NULL');

    /*
     * Se copia lo que ya estaba guardado.
     *
     * `JSON_VALUE` devuelve nulo si la clave no existe, así que los leads que llegaron por otras
     * vías quedan vacíos sin necesidad de filtrarlos aparte.
     */
    await queryRunner.query(`
      UPDATE leads
      SET external_form_name = JSON_VALUE(metadata, '$.formName')
      WHERE metadata IS NOT NULL AND JSON_VALUE(metadata, '$.formName') IS NOT NULL
    `);

    /*
     * El índice incluye la organización porque nadie filtra por formulario a secas: se filtra
     * dentro de un CRM. Un índice solo sobre el nombre obligaría a leer filas de otras
     * organizaciones para descartarlas.
     */
    await queryRunner.query(
      'CREATE INDEX IDX_leads_org_form_name ON leads (organization_id, external_form_name)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'leads' AND column_name = 'external_form_name'
    `);
    if (Number(columnas?.[0]?.n ?? 0) === 0) return;

    await queryRunner.query('DROP INDEX IDX_leads_org_form_name ON leads');
    await queryRunner.query('ALTER TABLE leads DROP COLUMN external_form_name');
  }
}
