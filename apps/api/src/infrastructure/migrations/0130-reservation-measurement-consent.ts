import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReservationMeasurementConsent1758200000000 implements MigrationInterface {
  name = 'ReservationMeasurementConsent1758200000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reservations' AND column_name = 'measurement_consent_at'");
    if (Number(rows?.[0]?.n ?? 0) === 0) await queryRunner.query('ALTER TABLE reservations ADD COLUMN measurement_consent_at TIMESTAMP NULL');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reservations' AND column_name = 'measurement_consent_at'");
    if (Number(rows?.[0]?.n ?? 0) > 0) await queryRunner.query('ALTER TABLE reservations DROP COLUMN measurement_consent_at');
  }
}
