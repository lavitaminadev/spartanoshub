import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Paso ejecutado dentro de una automatización.
 *
 * Es la diferencia entre "la automatización falló" y "falló al asignar responsable porque el
 * usuario ya no estaba activo". Sin esta tabla, diagnosticar obliga a leer los registros del
 * servidor y cruzarlos a mano con la ejecución.
 *
 * También es la base del "probar este paso" del editor: se ejecuta un nodo aislado con datos
 * reales y se guarda su entrada y su salida sin tocar el resto del grafo.
 *
 * Las filas no se editan. Un paso que se puede reescribir no sirve para explicar qué pasó.
 */
@Entity('automation_run_steps')
@Index('IDX_automation_run_steps_run', ['runId', 'createdAt'])
export class AutomationRunStep {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'run_id', type: 'uuid' }) runId: string;

  @Column({ name: 'node_id', type: 'varchar', length: 60 }) nodeId: string;
  @Column({ name: 'node_type', type: 'varchar', length: 20 }) nodeType: string;
  /** Clave del catálogo que se ejecutó, para poder agrupar por acción. */
  @Column({ name: 'node_key', type: 'varchar', length: 60 }) nodeKey: string;

  @Column({ type: 'varchar', length: 20 }) status: 'completed' | 'failed' | 'skipped';

  /**
   * Qué recibió y qué produjo el nodo.
   *
   * Se guardan recortados por el ejecutor: el contexto completo de una ejecución larga puede
   * crecer mucho y esta tabla tiene una fila por paso y por ejecución.
   */
  @Column({ type: 'json', nullable: true }) input?: Record<string, unknown> | null;
  @Column({ type: 'json', nullable: true }) output?: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true }) error?: string | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true }) durationMs?: number | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
