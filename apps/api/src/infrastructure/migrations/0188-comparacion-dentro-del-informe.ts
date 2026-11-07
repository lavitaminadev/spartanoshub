import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * El informe mensual guarda contra qué se comparó.
 *
 * Las métricas del mes anterior se congelan junto a las del período en lugar de calcularse al
 * abrir el informe: un documento publicado en abril debe seguir mostrando en octubre la
 * comparación que mostró el día que se firmó. Si se calculara al leerlo, una corrección posterior
 * de los datos de marzo cambiaría un informe ya entregado, y el PDF que tiene el cliente dejaría
 * de coincidir con la pantalla.
 *
 * Nulas para todo lo que ya existe: los informes anteriores muestran su período sin comparación,
 * que es exactamente lo que mostraban antes.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class ComparacionDentroDelInforme1790000000188 implements MigrationInterface {
  name = 'ComparacionDentroDelInforme1790000000188';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('monthly_reports'))) return;
    if (!(await hayColumna(queryRunner, 'monthly_reports', 'metrics_previous'))) {
      await queryRunner.query('ALTER TABLE monthly_reports ADD COLUMN metrics_previous JSON NULL');
    }
    if (!(await hayColumna(queryRunner, 'monthly_reports', 'previous_period_start'))) {
      await queryRunner.query('ALTER TABLE monthly_reports ADD COLUMN previous_period_start DATE NULL');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('monthly_reports'))) return;
    for (const columna of ['previous_period_start', 'metrics_previous']) {
      if (await hayColumna(queryRunner, 'monthly_reports', columna)) {
        await queryRunner.query(`ALTER TABLE monthly_reports DROP COLUMN ${columna}`);
      }
    }
  }
}
