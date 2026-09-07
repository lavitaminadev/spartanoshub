import { MigrationInterface, QueryRunner } from 'typeorm';

/** Migración aditiva: no modifica reservas ni formularios existentes. */
// El timestamp 1757400000000 ya pertenece a una migración CRM publicada. TypeORM ordena por
// este sufijo, por lo que reutilizarlo hacía ambiguo el historial de producción.
export class ReservationManagementTokens1758310000000 implements MigrationInterface {
  name = 'ReservationManagementTokens1758310000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('reservation_management_tokens');
    if (exists) {
      // Las primeras copias locales usaban un único enlace por reserva. La versión final
      // permite que un recordatorio tenga su propio enlace sin invalidar el comprobante.
      const indexes = await queryRunner.query("SHOW INDEX FROM reservation_management_tokens WHERE Key_name = 'UQ_reservation_management_reservation'");
      if (Array.isArray(indexes) && indexes.length > 0) {
        await queryRunner.query('ALTER TABLE reservation_management_tokens DROP INDEX UQ_reservation_management_reservation, ADD INDEX IDX_reservation_management_reservation (reservation_id)');
      }
      return;
    }
    await queryRunner.query(`CREATE TABLE reservation_management_tokens (
      id char(36) NOT NULL, reservation_id char(36) NOT NULL, token_hash char(64) NOT NULL,
      expires_at timestamp NOT NULL, revoked_at timestamp NULL, used_at timestamp NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id), UNIQUE KEY UQ_reservation_management_token_hash (token_hash),
      KEY IDX_reservation_management_reservation (reservation_id),
      KEY IDX_reservation_management_expires (expires_at),
      CONSTRAINT FK_reservation_management_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('reservation_management_tokens')) await queryRunner.dropTable('reservation_management_tokens');
  }
}
