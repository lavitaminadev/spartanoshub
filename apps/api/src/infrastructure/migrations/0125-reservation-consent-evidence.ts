import { MigrationInterface, QueryRunner } from 'typeorm';

/** Consentimiento de servicio y marketing son propósitos distintos y auditables. */
export class ReservationConsentEvidence1757700000000 implements MigrationInterface {
  name = 'ReservationConsentEvidence1757700000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [column, definition] of [
      ['reservation_consent_at', 'TIMESTAMP NULL'],
      ['marketing_consent_at', 'TIMESTAMP NULL'],
      ['marketing_consent_version', 'VARCHAR(30) NULL'],
    ]) {
      const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reservations' AND column_name = ?", [column]);
      if (Number(rows?.[0]?.n ?? 0) === 0) await queryRunner.query(`ALTER TABLE reservations ADD COLUMN ${column} ${definition}`);
    }
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['marketing_consent_version', 'marketing_consent_at', 'reservation_consent_at']) {
      const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reservations' AND column_name = ?", [column]);
      if (Number(rows?.[0]?.n ?? 0) > 0) await queryRunner.query(`ALTER TABLE reservations DROP COLUMN ${column}`);
    }
  }
}
