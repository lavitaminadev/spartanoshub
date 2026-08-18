import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { OutboxStatus } from '../../core/outbox/outbox-processor.base';

/**
 * Envío pendiente a un servicio externo.
 *
 * Es la misma bandeja de salida que ya usan Meta y Google, por la misma razón: un tercero
 * caído o lento no puede dejar colgada una automatización ni retener la ejecución mientras
 * responde. La acción escribe acá y un trabajo aparte hace la llamada.
 *
 * Sin esto, un webhook apuntando a un servidor que no contesta bloquearía el ejecutor durante
 * su tiempo de espera, y con él todas las demás automatizaciones de la misma tanda.
 */
@Entity('automation_webhook_deliveries')
@Index('IDX_webhook_deliveries_pending', ['status', 'nextAttemptAt'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  /** Ejecución que lo originó, para poder explicar de dónde salió cada llamada. */
  @Column({ name: 'run_id', type: 'uuid', nullable: true }) runId?: string | null;

  @Column({ type: 'varchar', length: 500 }) url: string;
  @Column({ type: 'json' }) payload: Record<string, unknown>;

  /**
   * Comparte los estados de las demás bandejas de salida, no un juego propio.
   *
   * Antes usaba «sent» donde las otras usan «processed». Con nombres distintos para lo mismo,
   * el procesador común no podía servirlas a las tres y cada consulta de diagnóstico tenía que
   * saber en qué bandeja estaba mirando.
   */
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: OutboxStatus;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ name: 'next_attempt_at', type: 'timestamp', nullable: true }) nextAttemptAt?: Date | null;

  /** Código de la última respuesta, para distinguir un rechazo de una caída. */
  @Column({ name: 'last_status_code', type: 'int', nullable: true }) lastStatusCode?: number | null;
  @Column({ name: 'last_error', type: 'text', nullable: true }) lastError?: string | null;

  /** Momento del envío correcto. La columna se llama `sent_at` por lo que describe. */
  @Column({ name: 'sent_at', type: 'timestamp', nullable: true }) processedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
