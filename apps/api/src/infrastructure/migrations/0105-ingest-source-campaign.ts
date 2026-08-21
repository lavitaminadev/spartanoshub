import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Campaña a la que pertenece una llave de entrada.
 *
 * Hasta ahora el nombre de la campaña venía en el cuerpo del mensaje, así que dependía de que
 * quien configura el escenario lo escribiera exactamente igual al de la campaña registrada. Un
 * espacio de más y el lead entraba con una campaña que no existe: la inversión no se repartía
 * entre nadie y el costo por lead quedaba en nada, sin que nada fallara.
 *
 * Con la campaña en la llave, quien la usa no puede equivocarse: el lead pertenece a la campaña
 * de la llave con la que entró, igual que ya pertenece a su cuenta.
 *
 * Admite vacío para las llaves que ya existen: siguen tomando la campaña del cuerpo, como antes.
 */
export class IngestSourceCampaign1755900000105 implements MigrationInterface {
  name = 'IngestSourceCampaign1755900000105';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('lead_ingest_sources'))) return;
    if (await queryRunner.hasColumn('lead_ingest_sources', 'campaign_name')) return;

    await queryRunner.addColumn('lead_ingest_sources', new TableColumn({
      name: 'campaign_name',
      type: 'varchar',
      length: '180',
      isNullable: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('lead_ingest_sources', 'campaign_name')) {
      await queryRunner.dropColumn('lead_ingest_sources', 'campaign_name');
    }
  }
}
