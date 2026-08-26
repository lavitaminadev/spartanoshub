import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Da un período de gracia a la llave anterior cuando se rota.
 *
 * Rotar mataba la llave anterior en el acto, así que entre el clic y el momento en que alguien
 * pega la nueva en Make, todo lead que llegara se perdía. Nadie lo veía: la integración recibía
 * 401 y el lead no quedaba en ningún sitio, ni siquiera como error.
 *
 * El hueco importa justo cuando más urge rotar —una llave filtrada— porque entonces se rota
 * rápido y se actualiza después.
 *
 * Con estas dos columnas, la anterior sigue aceptando durante la ventana y luego caduca sola. No
 * debilita el almacenamiento: se guarda su huella, igual que la vigente, y nunca la llave.
 */
export class LlaveAnteriorConGracia1756300000111 implements MigrationInterface {
  name = 'LlaveAnteriorConGracia1756300000111';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('lead_ingest_sources'))) return;

    if (!(await queryRunner.hasColumn('lead_ingest_sources', 'previous_token_hash'))) {
      await queryRunner.addColumn('lead_ingest_sources', new TableColumn({
        name: 'previous_token_hash', type: 'varchar', length: '64', isNullable: true,
      }));
    }
    if (!(await queryRunner.hasColumn('lead_ingest_sources', 'previous_token_expires_at'))) {
      await queryRunner.addColumn('lead_ingest_sources', new TableColumn({
        name: 'previous_token_expires_at', type: 'datetime', isNullable: true,
      }));
    }

    /*
     * Índice sobre la huella anterior, igual que sobre la vigente.
     *
     * Cada lead que entra durante la gracia se busca también por esta columna. Sin índice, esa
     * segunda búsqueda recorre la tabla entera en la ruta que más veces se llama.
     *
     * No es único: dos orígenes distintos pueden tener su anterior caducada a la vez, y exigir
     * unicidad sobre valores que dejan de importar convertiría una rotación en un error.
     */
    const tabla = await queryRunner.getTable('lead_ingest_sources');
    if (!tabla?.indices.some((indice) => indice.name === 'IDX_lead_ingest_sources_previous_token')) {
      await queryRunner.createIndex('lead_ingest_sources', new TableIndex({
        name: 'IDX_lead_ingest_sources_previous_token', columnNames: ['previous_token_hash'],
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('lead_ingest_sources'))) return;

    const tabla = await queryRunner.getTable('lead_ingest_sources');
    const indice = tabla?.indices.find((item) => item.name === 'IDX_lead_ingest_sources_previous_token');
    if (indice) await queryRunner.dropIndex('lead_ingest_sources', indice);

    for (const columna of ['previous_token_hash', 'previous_token_expires_at']) {
      if (await queryRunner.hasColumn('lead_ingest_sources', columna)) {
        await queryRunner.dropColumn('lead_ingest_sources', columna);
      }
    }
  }
}
