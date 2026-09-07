import { MigrationInterface, QueryRunner } from 'typeorm';

/** Conserva las preferencias que acompañan una solicitud antes de transformarla en reserva. */
export class ReservationGroupRequestDetails1758400000000 implements MigrationInterface {
  name = 'ReservationGroupRequestDetails1758400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reservation_group_requests' AND column_name = 'details'");
    if (Number(rows?.[0]?.n ?? 0) === 0) await queryRunner.query('ALTER TABLE reservation_group_requests ADD COLUMN details JSON NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reservation_group_requests' AND column_name = 'details'");
    if (Number(rows?.[0]?.n ?? 0) > 0) await queryRunner.query('ALTER TABLE reservation_group_requests DROP COLUMN details');
  }
}
