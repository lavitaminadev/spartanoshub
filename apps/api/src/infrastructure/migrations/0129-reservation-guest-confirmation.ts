import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReservationGuestConfirmation1758100000000 implements MigrationInterface {
  name = 'ReservationGuestConfirmation1758100000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reservations' AND column_name = 'guest_confirmed_at'");
    if (Number(rows?.[0]?.n ?? 0) === 0) await queryRunner.query('ALTER TABLE reservations ADD COLUMN guest_confirmed_at TIMESTAMP NULL');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reservations' AND column_name = 'guest_confirmed_at'");
    if (Number(rows?.[0]?.n ?? 0) > 0) await queryRunner.query('ALTER TABLE reservations DROP COLUMN guest_confirmed_at');
  }
}
