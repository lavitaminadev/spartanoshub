import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Solicitud enviada desde la página pública de solicitudes (login → "Solicitudes").
 *
 * Tipos: creación de cuenta, alta de empresa, rectificación de datos, anonimización,
 * portabilidad, baja y soporte. Cada una se resuelve desde Seguridad con botones de acción
 * según su tipo, y cada resolución queda auditada. El solicitante consulta el estado y el
 * historial con correo + RUT.
 */
@Entity('service_requests')
@Index('IDX_service_requests_org_created', ['organizationId', 'createdAt'])
@Index('IDX_service_requests_email', ['requesterEmail'])
@Index('IDX_service_requests_status', ['status'])
export class ServiceRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid', nullable: true }) organizationId?: string | null;
  /** Tipo de solicitud: account | company | rectification | anonymization | portability | removal | support */
  @Column({ type: 'varchar', length: 40 }) type: string;
  /** received | in_review | resolved | rejected | more_info */
  @Column({ type: 'varchar', length: 20, default: 'received' }) status: string;
  @Column({ name: 'requester_name', type: 'varchar', length: 180 }) requesterName: string;
  @Column({ name: 'requester_email', type: 'varchar', length: 190 }) requesterEmail: string;
  @Column({ name: 'requester_rut', type: 'varchar', length: 20, nullable: true }) requesterRut?: string | null;
  @Column({ name: 'requester_phone', type: 'varchar', length: 50, nullable: true }) requesterPhone?: string | null;
  @Column({ type: 'text', nullable: true }) message?: string | null;
  @Column({ type: 'json', nullable: true }) extra?: Record<string, unknown> | null;
  @Column({ name: 'resolution_note', type: 'text', nullable: true }) resolutionNote?: string | null;
  @Column({ name: 'resolved_by', type: 'uuid', nullable: true }) resolvedBy?: string | null;
  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true }) resolvedAt?: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
