import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Completa el juego de UTM en las dos tablas que sólo guardaban origen y campaña.
 *
 * `reservations` ya conservaba medio y contenido desde el inicio, así que una campaña medida
 * por medio cuadraba para las reservas y quedaba en blanco para las solicitudes de grupo y las
 * respuestas de encuesta. Las columnas repiten el largo de `reservations` para que una URL que
 * entra por cualquiera de las tres puertas se guarde igual y no se trunque en unas y en otras no.
 */
export class UtmMedioYContenido1758500000000 implements MigrationInterface {
  name = 'UtmMedioYContenido1758500000000';

  private static readonly COLUMNAS: Array<{ tabla: string; columna: string; tipo: string }> = [
    { tabla: 'reservation_group_requests', columna: 'utm_medium', tipo: 'varchar(120)' },
    { tabla: 'reservation_group_requests', columna: 'utm_content', tipo: 'varchar(180)' },
    { tabla: 'reservation_form_events', columna: 'utm_medium', tipo: 'varchar(120)' },
    { tabla: 'reservation_form_events', columna: 'utm_content', tipo: 'varchar(180)' },
  ];

  private async existe(queryRunner: QueryRunner, tabla: string, columna: string): Promise<boolean> {
    const rows = await queryRunner.query(
      'SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
      [tabla, columna],
    );
    return Number(rows?.[0]?.n ?? 0) > 0;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const { tabla, columna, tipo } of UtmMedioYContenido1758500000000.COLUMNAS) {
      if (await this.existe(queryRunner, tabla, columna)) continue;
      await queryRunner.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${tipo} NULL`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const { tabla, columna } of UtmMedioYContenido1758500000000.COLUMNAS) {
      if (!(await this.existe(queryRunner, tabla, columna))) continue;
      await queryRunner.query(`ALTER TABLE ${tabla} DROP COLUMN ${columna}`);
    }
  }
}
