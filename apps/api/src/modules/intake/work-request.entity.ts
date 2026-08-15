import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';

/**
 * Área que ejecuta el trabajo pedido.
 *
 * Determina qué sección del formulario se muestra y quién lo ve después. Un solo formulario con
 * secciones y no tres formularios distintos: quien pide no siempre sabe si lo suyo es diseño o
 * audiovisual, y obligarlo a elegir formulario antes de describir el trabajo es empujarle una
 * decisión que le corresponde a Operaciones.
 */
export enum WorkRequestArea {
  DESIGN = 'design',
  AUDIOVISUAL = 'audiovisual',
  COMMUNITY = 'community',
}

/**
 * Estados de una solicitud.
 *
 * Termina en `converted` o en `rejected`; nunca se borra. Una solicitud rechazada explica por
 * qué no se hizo algo, y ese dato vale tanto como el de lo que sí se hizo.
 */
export enum WorkRequestStatus {
  NEW = 'new',
  IN_REVIEW = 'in_review',
  ACCEPTED = 'accepted',
  CONVERTED = 'converted',
  REJECTED = 'rejected',
}

export const WORK_REQUEST_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type WorkRequestPriority = (typeof WORK_REQUEST_PRIORITIES)[number];

/**
 * Solicitud de trabajo: la puerta de entrada única a producción.
 *
 * Existe separada de `pieces` porque son cosas distintas y confundirlas se paga después. Una
 * solicitud puede convertirse en varias piezas —un carrusel más sus historias—, puede
 * rechazarse sin llegar a ser ninguna, y guarda lo que pidió quien la abrió, que no cambia
 * aunque la pieza pase por cinco estados.
 *
 * Los campos por área van en JSON a propósito: cada área define los suyos y los cambia sin
 * migración. Lo que es común a todas —cliente, plazo, prioridad, responsable— sí son columnas,
 * porque se filtra y se ordena por ellas.
 */
@Entity('work_requests')
@Index('IDX_work_requests_org_status', ['organizationId', 'status'])
@Index('IDX_work_requests_org_client', ['organizationId', 'clientId'])
@Index('IDX_work_requests_assignee', ['organizationId', 'assignedTo'])
export class WorkRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client?: Client;

  /** Correlativo legible por organización, para poder nombrarla en una conversación. */
  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 30 })
  area: WorkRequestArea;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'normal' })
  priority: WorkRequestPriority;

  @Column({ type: 'varchar', length: 20, default: WorkRequestStatus.NEW })
  status: WorkRequestStatus;

  /** Cuándo lo necesita quien lo pide. No es el plazo de producción: ese lo pone Operaciones. */
  @Column({ name: 'needed_by', type: 'date', nullable: true })
  neededBy?: Date | null;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by' })
  requester?: User;

  /** Responsable de ejecutarla. Solo Operaciones lo fija. */
  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignee?: User | null;

  /** Campos creativos, definidos por Dirección Creativa. */
  @Column({ name: 'creative_fields', type: 'json', nullable: true })
  creativeFields?: Record<string, unknown> | null;

  /** Campos operativos, definidos por Dirección de Operaciones. */
  @Column({ name: 'operational_fields', type: 'json', nullable: true })
  operationalFields?: Record<string, unknown> | null;

  /** Obligatorio al rechazar: una solicitud rechazada sin motivo se vuelve a pedir igual. */
  @Column({ name: 'rejection_reason', type: 'varchar', length: 500, nullable: true })
  rejectionReason?: string | null;

  /**
   * Piezas gráficas que nacieron de esta solicitud. Solo para el área de diseño.
   *
   * Una solicitud audiovisual **no** produce piezas: produce una sesión, que es otra tabla y
   * otro ciclo. Guardar ambas cosas en la misma columna obligaría a mirar el área para saber
   * qué son esos identificadores, y esa es exactamente la confusión que separa las áreas.
   */
  @Column({ name: 'piece_ids', type: 'json', nullable: true })
  pieceIds?: string[] | null;

  /** Sesión audiovisual que nació de esta solicitud. Solo para el área audiovisual. */
  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId?: string | null;

  /**
   * Momentos del ciclo. Son el insumo de los SLA por etapa: sin ellos no se puede saber
   * cuánto demora de verdad cada tramo, solo cuánto se cree que demora.
   */
  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt?: Date | null;

  /**
   * Cuándo se aceptó. Separa el tiempo que tarda Operaciones en decidir del que tarda el área
   * en convertirla: sin esta marca ambos quedan sumados en un solo tramo y no se distingue
   * cuál de los dos hay que corregir.
   */
  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt?: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
