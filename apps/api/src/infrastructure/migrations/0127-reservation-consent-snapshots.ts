import { MigrationInterface, QueryRunner } from 'typeorm';

/** Preserva el texto realmente aceptado aunque la empresa lo edite después. */
export class ReservationConsentSnapshots1757900000000 implements MigrationInterface {
  name = 'ReservationConsentSnapshots1757900000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['reservations', 'reservation_group_requests']) for (const column of ['reservation_consent_text', 'marketing_consent_text']) {
      const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?", [table, column]);
      if (Number(rows?.[0]?.n ?? 0) === 0) await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT NULL`);
    }
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['reservation_group_requests', 'reservations']) for (const column of ['marketing_consent_text', 'reservation_consent_text']) {
      const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?", [table, column]);
      if (Number(rows?.[0]?.n ?? 0) > 0) await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
    }
  }
}
