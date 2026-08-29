import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { ApprovalRequestStatus, PendingKind } from './approval-request-status.enum';

@Entity('approval_requests')
@Index('IDX_approval_requests_org_created', ['organizationId', 'createdAt'])
/*
 * La consulta que se hace todo el día: qué tiene pendiente esta persona, lo más vencido
 * primero. Sin este índice recorre la tabla entera, y es la que crece con cada pieza que se
 * manda a aprobar y con cada tarea que se abre.
 */
@Index('IDX_approval_requests_assignee_open', ['assignedTo', 'status', 'dueAt'])
/* El trabajo periódico que anuncia lo vencido filtra por estas dos. */
@Index('IDX_approval_requests_kind_due', ['kind', 'status', 'dueAt'])
export class ApprovalRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId?: string;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'client_id' })
  client?: Client;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Clase de pendiente.
   *
   * Nace como `approval` para que las filas anteriores a esta columna sigan significando lo
   * mismo: todas eran aprobaciones cuando se escribieron.
   */
  @Column({ type: 'varchar', length: 20, default: PendingKind.APPROVAL })
  kind: PendingKind;

  /**
   * Registro al que pertenece: `piece`, `lead`, `opportunity`, `session`, `work_request`.
   *
   * Estaba limitado a `piece` por el DTO, no por la tabla. Al abrirlo a los registros del CRM,
   * una tarea puede colgar de un prospecto o de un trato sin necesitar tabla propia.
   */
  @Column({ name: 'entity_type', type: 'varchar', length: 100 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by' })
  requestedByUser: User;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo?: string;

  @Column({ type: 'varchar', length: 50, default: ApprovalRequestStatus.PENDING })
  status: ApprovalRequestStatus;

  @Column({ name: 'decision_at', type: 'timestamp', nullable: true })
  decisionAt?: Date;

  @Column({ name: 'decision_notes', type: 'text', nullable: true })
  decisionNotes?: string;

  @Column({ name: 'due_at', type: 'timestamp', nullable: true })
  dueAt?: Date;

  /**
   * Último recordatorio previo al vencimiento que ya se envió.
   *
   * El trabajo que los manda corre cada media hora; sin esto reenviaría el mismo correo en cada
   * pasada. Se guarda cuál y no cuándo, porque lo que hay que responder es «¿ya avisé del de 3
   * horas?», y una fecha obliga a reconstruir esa respuesta en cada comparación.
   */
  @Column({ name: 'reminder_sent', type: 'varchar', length: 10, nullable: true })
  reminderSent?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
