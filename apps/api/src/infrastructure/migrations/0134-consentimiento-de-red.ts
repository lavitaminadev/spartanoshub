import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Evidencia del permiso para reutilizar los datos en otros locales de la red.
 *
 * Sin esto, reconocer a alguien que ya reservó en otro local sólo podía apoyarse en el
 * consentimiento operativo, que autoriza gestionar *esa* reserva y nada más. La autorización
 * para compartir es un propósito distinto y por lo tanto necesita su propia casilla, su propia
 * fecha y el texto exacto que la persona leyó: cuando alguien pregunta «¿quién les dio mis
 * datos?», la respuesta tiene que poder mostrarse tal como estaba redactada ese día.
 *
 * Se guarda el instante y no un sí/no porque un booleano no distingue «dijo que no» de «nunca
 * se le preguntó», y esa distinción es justamente la que decide si se puede compartir.
 */
export class ConsentimientoDeRed1758600000000 implements MigrationInterface {
  name = 'ConsentimientoDeRed1758600000000';

  private static readonly COLUMNAS: Array<{ tabla: string; columna: string; tipo: string }> = [
    { tabla: 'reservations', columna: 'network_consent_at', tipo: 'timestamp' },
    { tabla: 'reservations', columna: 'network_consent_version', tipo: 'varchar(30)' },
    { tabla: 'reservations', columna: 'network_consent_text', tipo: 'text' },
    { tabla: 'reservation_group_requests', columna: 'network_consent_at', tipo: 'timestamp' },
    { tabla: 'reservation_group_requests', columna: 'network_consent_text', tipo: 'text' },
  ];

  private async existe(queryRunner: QueryRunner, tabla: string, columna: string): Promise<boolean> {
    const rows = await queryRunner.query(
      'SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
      [tabla, columna],
    );
    return Number(rows?.[0]?.n ?? 0) > 0;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const { tabla, columna, tipo } of ConsentimientoDeRed1758600000000.COLUMNAS) {
      if (await this.existe(queryRunner, tabla, columna)) continue;
      await queryRunner.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${tipo} NULL`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const { tabla, columna } of ConsentimientoDeRed1758600000000.COLUMNAS) {
      if (!(await this.existe(queryRunner, tabla, columna))) continue;
      await queryRunner.query(`ALTER TABLE ${tabla} DROP COLUMN ${columna}`);
    }
  }
}
