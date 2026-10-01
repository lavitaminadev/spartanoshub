import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * La prórroga del plazo para responder una solicitud de derechos.
 *
 * El plazo —treinta días corridos desde que entra la solicitud, prorrogables una sola vez por
 * otros treinta avisando antes y explicando el motivo— estaba escrito en las políticas que el
 * comensal lee y en ninguna parte del sistema. Una solicitud podía vencer sin que nadie se
 * enterara, y lo que se incumple no es «no responder» sino «no responder a tiempo».
 *
 * Se guarda la fecha y el motivo: una prórroga sin motivo no vale, y lo que hay que poder
 * demostrar después es hasta cuándo se dijo que se respondía.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class ProrrogaDeSolicitud1790000000168 implements MigrationInterface {
  name = 'ProrrogaDeSolicitud1790000000168';

  private readonly columnas: Array<[string, string]> = [
    ['extended_until', 'TIMESTAMP NULL'],
    ['extended_reason', 'VARCHAR(300) NULL'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('service_requests'))) return;
    for (const [columna, tipo] of this.columnas) {
      if (!(await hayColumna(queryRunner, 'service_requests', columna))) {
        await queryRunner.query(`ALTER TABLE service_requests ADD COLUMN ${columna} ${tipo}`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('service_requests'))) return;
    for (const [columna] of [...this.columnas].reverse()) {
      if (await hayColumna(queryRunner, 'service_requests', columna)) {
        await queryRunner.query(`ALTER TABLE service_requests DROP COLUMN ${columna}`);
      }
    }
  }
}
