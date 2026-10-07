import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cada uso de un cupón, con su fecha y de dónde vino.
 *
 * El cupón guardaba `usage_count`, un contador. Decía cuántas veces se usó y nada más: ni cuándo,
 * ni en qué reserva, ni quién lo aplicó. Con eso no se puede responder si un cupón rindió, en qué
 * semana, ni cuánto descuento costó —y tampoco justificar un descuento ante quien paga—.
 *
 * `reservation_id` es nulo a propósito. Alguien puede llegar al local con el código en el teléfono
 * sin haber reservado, y hasta ahora ese canje no tenía dónde anotarse: se aplicaba el descuento y
 * no quedaba rastro. Un cupón canjeado sin reserva es un hecho tan real como el otro, y la
 * diferencia se lee en `canal`.
 *
 * El contador no se retira. Sigue siendo lo que mira la validación para decidir si quedan usos, y
 * sustituirlo por un `COUNT` en cada reserva pondría una consulta en el camino crítico del cupo.
 * Esta tabla es el detalle, no la verdad operativa.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class CanjesDeCupon1790000000174 implements MigrationInterface {
  name = 'CanjesDeCupon1790000000174';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('reservation_coupon_redemptions')) return;
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservation_coupon_redemptions'))) return;
    await queryRunner.query('DROP TABLE reservation_coupon_redemptions');
  }
}
