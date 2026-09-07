import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReservationGroupRequests1757800000000 implements MigrationInterface {
  name = 'ReservationGroupRequests1757800000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('reservation_group_requests')) return;
    await queryRunner.query(`CREATE TABLE reservation_group_requests (
      id uuid NOT NULL, organization_id uuid NOT NULL, client_id uuid NOT NULL, form_id uuid NOT NULL,
      idempotency_key varchar(80) NOT NULL, guest_name varchar(180) NOT NULL, guest_email varchar(190) NULL, guest_phone varchar(50) NULL,
      party_size smallint NOT NULL, event_type varchar(30) NOT NULL, preferred_date date NULL, preferred_time varchar(80) NULL,
      notes text NULL, reservation_consent_at timestamp NULL, marketing_consent_at timestamp NULL,
      utm_source varchar(120) NULL, utm_campaign varchar(180) NULL, status varchar(20) NOT NULL DEFAULT 'pending',
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id), UNIQUE KEY UQ_reservation_group_request_idempotency (form_id, idempotency_key),
      KEY IDX_reservation_group_requests_form_status (form_id, status, created_at),
      CONSTRAINT FK_reservation_group_requests_form FOREIGN KEY (form_id) REFERENCES reservation_forms(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
  async down(queryRunner: QueryRunner): Promise<void> { if (await queryRunner.hasTable('reservation_group_requests')) await queryRunner.dropTable('reservation_group_requests'); }
}
