import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Última corrida de una tarea programada.
 *
 * Una fila por tarea, reescrita en cada ejecución: lo que hace falta responder es «¿esto se está
 * ejecutando?», no reconstruir la historia. Sin este rastro, un correo encendido en pantalla puede
 * no salir nunca porque nadie creó el cron, y nada lo delata.
 */
@Entity('cron_runs')
export class CronRun {
  /** Nombre de la tarea, igual que su ruta: `recordatorio-reservas`, `meta-capi`… */
  @PrimaryColumn({ type: 'varchar', length: 80 }) task: string;

  @Column({ name: 'last_run_at', type: 'timestamp' }) lastRunAt: Date;

  @Column({ type: 'boolean', default: true }) ok: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true }) detail?: string | null;
}
