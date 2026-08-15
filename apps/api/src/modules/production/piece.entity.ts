import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
import { PieceStatus } from './piece-status.enum';
import { CancelOrigin } from './cancel-origin.enum';
import { PieceType } from './piece-type.enum';

@Entity('pieces')
export class Piece {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @ManyToOne(() => Client) @JoinColumn({ name: 'client_id' }) client: Client;
  @Column({ name: 'assigned_to', type: 'uuid', nullable: true }) assignedTo?: string;
  @Column({ name: 'assigned_at', type: 'timestamp', nullable: true }) assignedAt?: Date;
  @Column({ name: 'started_at', type: 'timestamp', nullable: true }) startedAt?: Date;
  /**
   * Clave del tipo en el catálogo de la organización.
   *
   * Es texto y no el `enum` porque el catálogo se amplía en caliente: un tipo aprobado después de
   * compilar no existe como valor del `enum` y la pieza igual tiene que poder guardarlo. La
   * validación de que el tipo esté activo se hace contra el catálogo, que es donde vive el dato.
   */
  @Column({ type: 'varchar', length: 50 }) type: string;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'varchar', length: 50, default: PieceStatus.BACKLOG }) status: PieceStatus;

  /** De quien fue la decision de cancelar; se declara al cancelar y no se deduce del cargo. */
  @Column({ name: 'cancel_origin', type: 'varchar', length: 20, nullable: true }) cancelOrigin?: CancelOrigin;
  @Column({ name: 'cancel_reason', type: 'varchar', length: 500, nullable: true }) cancelReason?: string;
  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true }) cancelledAt?: Date;
  @Column({ name: 'cancelled_by', type: 'varchar', length: 36, nullable: true }) cancelledBy?: string;
  @Column({ name: 'difficulty_level', type: 'tinyint', default: 1 }) difficultyLevel: number;
  @Column({ name: 'ud_amount', type: 'decimal', precision: 8, scale: 2, default: 0 }) udAmount: number;
  @Column({ name: 'deadline_at', type: 'timestamp', nullable: true }) deadlineAt?: Date;
  @Column({ name: 'dependency_ids', type: 'json', nullable: true }) dependencyIds?: string[];
  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true }) deliveredAt?: Date;
  @Column({ name: 'correction_count', type: 'int', default: 0 }) correctionCount: number;
  @Column({ name: 'client_correction_count', type: 'int', default: 0 }) clientCorrectionCount: number;
  @Column({ name: 'drive_link', type: 'varchar', length: 255, nullable: true }) driveLink?: string;
  @Column({ name: 'stale_alerted_at', type: 'timestamp', nullable: true }) staleAlertedAt?: Date;
  @Column({ type: 'text', nullable: true }) description?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
