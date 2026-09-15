import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Distingue el canal que se reconoció solo (app, anuncio o sitio de origen) del que alguien marcó
 * con un enlace. Antes se anotaba en `utm_content`, que es el campo del anuncio, y aparecía en los
 * reportes como si fuera uno. Columnas nuevas en falso: lo existente no cambia.
 */
export class OrigenDetectado1789800000000 implements MigrationInterface {
  name = 'OrigenDetectado1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of ['reservations', 'reservation_form_events', 'reservation_group_requests']) {
      if (await queryRunner.hasTable(tabla) && !(await queryRunner.hasColumn(tabla, 'origin_detected'))) {
        await queryRunner.addColumn(tabla, new TableColumn({ name: 'origin_detected', type: 'tinyint', width: 1, default: 0 }));
      }
    }
    // Lo anotado antes en el campo del anuncio pasa a la marca y libera el campo.
    for (const tabla of ['reservations', 'reservation_form_events', 'reservation_group_requests']) {
      if (await queryRunner.hasTable(tabla)) {
        await queryRunner.query(`UPDATE ${tabla} SET origin_detected = 1, utm_content = NULL WHERE utm_content = 'deteccion-automatica'`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of ['reservation_group_requests', 'reservation_form_events', 'reservations']) {
      if (await queryRunner.hasTable(tabla) && await queryRunner.hasColumn(tabla, 'origin_detected')) {
        await queryRunner.query(`UPDATE ${tabla} SET utm_content = 'deteccion-automatica' WHERE origin_detected = 1 AND utm_content IS NULL`);
        await queryRunner.dropColumn(tabla, 'origin_detected');
      }
    }
  }
}
