import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Cupo temporal del formulario público. Sólo consume capacidad mientras no vence. */
@Entity('reservation_holds')
@Index('UQ_reservation_hold_form_key', ['formId', 'holdKey'], { unique: true })
@Index('IDX_reservation_hold_active', ['formId', 'expiresAt'])
export class ReservationHold {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'form_id', type: 'uuid' }) formId: string;
  @Column({ name: 'hold_key', type: 'varchar', length: 80 }) holdKey: string;
  @Column({ name: 'starts_at', type: 'timestamp' }) startsAt: Date;
  @Column({ name: 'ends_at', type: 'timestamp' }) endsAt: Date;
  @Column({ name: 'party_size', type: 'smallint' }) partySize: number;
  @Column({ name: 'service_id', type: 'varchar', length: 120, nullable: true }) serviceId?: string;
  @Column({ name: 'resource_id', type: 'varchar', length: 120, nullable: true }) resourceId?: string;
  @Column({ name: 'expires_at', type: 'timestamp' }) expiresAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
