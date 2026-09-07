"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationManagementTokens1758310000000 = void 0;
class ReservationManagementTokens1758310000000 {
    constructor() {
        this.name = 'ReservationManagementTokens1758310000000';
    }
    async up(queryRunner) {
        const exists = await queryRunner.hasTable('reservation_management_tokens');
        if (exists) {
            const indexes = await queryRunner.query("SHOW INDEX FROM reservation_management_tokens WHERE Key_name = 'UQ_reservation_management_reservation'");
            if (Array.isArray(indexes) && indexes.length > 0) {
                await queryRunner.query('ALTER TABLE reservation_management_tokens DROP INDEX UQ_reservation_management_reservation, ADD INDEX IDX_reservation_management_reservation (reservation_id)');
            }
            return;
        }
        await queryRunner.query(`CREATE TABLE reservation_management_tokens (
      id uuid NOT NULL, reservation_id uuid NOT NULL, token_hash char(64) NOT NULL,
      expires_at timestamp NOT NULL, revoked_at timestamp NULL, used_at timestamp NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id), UNIQUE KEY UQ_reservation_management_token_hash (token_hash),
      KEY IDX_reservation_management_reservation (reservation_id),
      KEY IDX_reservation_management_expires (expires_at),
      CONSTRAINT FK_reservation_management_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('reservation_management_tokens'))
            await queryRunner.dropTable('reservation_management_tokens');
    }
}
exports.ReservationManagementTokens1758310000000 = ReservationManagementTokens1758310000000;
