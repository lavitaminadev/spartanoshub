import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Solicitud sin cupo retenido: el equipo decide disponibilidad, menú y montaje. */
@Entity('reservation_group_requests')
@Index('IDX_reservation_group_requests_form_status', ['formId', 'status', 'createdAt'])
@Index('UQ_reservation_group_request_idempotency', ['formId', 'idempotencyKey'], { unique: true })
export class ReservationGroupRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @Column({ name: 'form_id', type: 'uuid' }) formId: string;
  @Column({ name: 'idempotency_key', type: 'varchar', length: 80 }) idempotencyKey: string;
  @Column({ name: 'guest_name', type: 'varchar', length: 180 }) guestName: string;
  @Column({ name: 'guest_email', type: 'varchar', length: 190, nullable: true }) guestEmail?: string | null;
  @Column({ name: 'guest_phone', type: 'varchar', length: 50, nullable: true }) guestPhone?: string | null;
  @Column({ name: 'party_size', type: 'smallint' }) partySize: number;
  @Column({ name: 'event_type', type: 'varchar', length: 30 }) eventType: string;
  @Column({ name: 'preferred_date', type: 'date', nullable: true }) preferredDate?: string | null;
  @Column({ name: 'preferred_time', type: 'varchar', length: 80, nullable: true }) preferredTime?: string | null;
  @Column({ type: 'text', nullable: true }) notes?: string | null;
  /** Preferencias y respuestas capturadas antes de que exista una reserva definitiva. */
  @Column({ type: 'json', nullable: true }) details?: Record<string, unknown> | null;
  @Column({ name: 'quote_amount', type: 'decimal', precision: 12, scale: 2, nullable: true }) quoteAmount?: string | null;
  @Column({ name: 'quote_message', type: 'text', nullable: true }) quoteMessage?: string | null;
  @Column({ name: 'quote_expires_at', type: 'timestamp', nullable: true }) quoteExpiresAt?: Date | null;
  @Column({ name: 'reservation_consent_at', type: 'timestamp', nullable: true }) reservationConsentAt?: Date | null;
  @Column({ name: 'reservation_consent_text', type: 'text', nullable: true }) reservationConsentText?: string | null;
  @Column({ name: 'marketing_consent_at', type: 'timestamp', nullable: true }) marketingConsentAt?: Date | null;
  @Column({ name: 'marketing_consent_text', type: 'text', nullable: true }) marketingConsentText?: string | null;
  @Column({ name: 'utm_source', type: 'varchar', length: 120, nullable: true }) utmSource?: string | null;
  @Column({ name: 'utm_campaign', type: 'varchar', length: 180, nullable: true }) utmCampaign?: string | null;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
