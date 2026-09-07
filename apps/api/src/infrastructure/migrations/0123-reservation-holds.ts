import { MigrationInterface, QueryRunner } from 'typeorm';

/** Retenciones efímeras de cupo; no modifica reservas existentes. */
export class ReservationHolds1757500000000 implements MigrationInterface {
  name = 'ReservationHolds1757500000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('reservation_holds')) return;
    await queryRunner.query(`CREATE TABLE reservation_holds (
      id uuid NOT NULL, form_id uuid NOT NULL, hold_key varchar(80) NOT NULL,
      starts_at timestamp NOT NULL, ends_at timestamp NOT NULL, party_size smallint NOT NULL,
      service_id varchar(120) NULL, resource_id varchar(120) NULL, expires_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id), UNIQUE KEY UQ_reservation_hold_form_key (form_id, hold_key),
      KEY IDX_reservation_hold_active (form_id, expires_at),
      CONSTRAINT FK_reservation_hold_form FOREIGN KEY (form_id) REFERENCES reservation_forms(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('reservation_holds')) await queryRunner.dropTable('reservation_holds');
  }
}
