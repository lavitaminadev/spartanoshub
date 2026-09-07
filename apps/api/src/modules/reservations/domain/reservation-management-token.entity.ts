import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Token opaco para que quien reservó pueda consultar o cancelar sin crear una cuenta. */
@Entity('reservation_management_tokens')
@Index('UQ_reservation_management_token_hash', ['tokenHash'], { unique: true })
@Index('IDX_reservation_management_reservation', ['reservationId'])
export class ReservationManagementToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'reservation_id', type: 'uuid' }) reservationId: string;
  @Column({ name: 'token_hash', type: 'char', length: 64 }) tokenHash: string;
  @Column({ name: 'expires_at', type: 'timestamp' }) expiresAt: Date;
  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true }) revokedAt?: Date | null;
  @Column({ name: 'used_at', type: 'timestamp', nullable: true }) usedAt?: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
