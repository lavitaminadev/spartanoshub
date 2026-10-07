"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CanjesDeCupon1790000000174 = void 0;
class CanjesDeCupon1790000000174 {
    constructor() {
        this.name = 'CanjesDeCupon1790000000174';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('reservation_coupon_redemptions'))
            return;
        await queryRunner.query(`
      CREATE TABLE reservation_coupon_redemptions (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        client_id CHAR(36) NULL,
        coupon_id CHAR(36) NOT NULL,
        codigo VARCHAR(40) NOT NULL,
        reservation_id CHAR(36) NULL,
        form_id CHAR(36) NULL,
        canal VARCHAR(20) NOT NULL DEFAULT 'reserva',
        monto DECIMAL(14,2) NULL,
        descuento DECIMAL(14,2) NULL,
        persona VARCHAR(190) NULL,
        nota VARCHAR(300) NULL,
        registrado_por CHAR(36) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX IDX_coupon_redemptions_cupon (coupon_id, created_at),
        INDEX IDX_coupon_redemptions_org_fecha (organization_id, created_at),
        INDEX IDX_coupon_redemptions_reserva (reservation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('reservation_coupon_redemptions')))
            return;
        await queryRunner.query('DROP TABLE reservation_coupon_redemptions');
    }
}
exports.CanjesDeCupon1790000000174 = CanjesDeCupon1790000000174;
