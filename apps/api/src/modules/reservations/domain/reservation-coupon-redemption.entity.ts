import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Cada uso de un cupón: cuándo, en qué reserva y por qué camino.
 *
 * El cupón sólo llevaba un contador. Servía para saber si quedaban usos y para nada más: no se
 * podía ver en qué semana se concentraron los canjes, cuánto descuento se entregó, ni justificar
 * un descuento aplicado ante quien paga la cuenta.
 *
 * `reservationId` nulo es un canje en el local, de alguien que llegó con el código sin haber
 * reservado. Hasta ahora ese caso no tenía dónde anotarse y el descuento se daba sin dejar
 * rastro; `canal` es lo que distingue los dos.
 */
@Entity('reservation_coupon_redemptions')
@Index('IDX_coupon_redemptions_cupon', ['couponId', 'createdAt'])
export class ReservationCouponRedemption {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string | null;
  @Column({ name: 'coupon_id', type: 'uuid' }) couponId: string;
  /**
   * El código tal como estaba al canjearse.
   *
   * Se copia en vez de leerse del cupón: si alguien lo renombra después, el histórico seguiría
   * diciendo el nombre nuevo sobre canjes que ocurrieron con el anterior.
   */
  @Column({ type: 'varchar', length: 40 }) codigo: string;
  @Column({ name: 'reservation_id', type: 'uuid', nullable: true }) reservationId?: string | null;
  @Column({ name: 'form_id', type: 'uuid', nullable: true }) formId?: string | null;
  /** `reserva` cuando vino de una reserva; `local` cuando se anotó a mano en el mostrador. */
  @Column({ type: 'varchar', length: 20, default: 'reserva' }) canal: 'reserva' | 'local';
  /** Lo que la persona consumió, cuando se anota. Nulo es «no se registró», no cero. */
  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true }) monto?: string | null;
  /** Lo que costó el descuento. Nulo cuando nadie lo anotó. */
  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true }) descuento?: string | null;
  /** Con qué se reconoció a la persona: su teléfono, correo o documento, según el cupón. */
  @Column({ type: 'varchar', length: 190, nullable: true }) persona?: string | null;
  @Column({ type: 'varchar', length: 300, nullable: true }) nota?: string | null;
  /** Quién lo anotó. Nulo cuando lo consumió la propia reserva, sin que nadie lo tocara. */
  @Column({ name: 'registrado_por', type: 'uuid', nullable: true }) registradoPor?: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
