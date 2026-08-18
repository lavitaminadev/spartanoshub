import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Un nodo del grafo. Su forma concreta depende del tipo y la valida el registro de nodos.
 *
 * `config` queda deliberadamente abierto: agregar una acción nueva debe ser escribir código,
 * no migrar la base. Es la razón por la que el grafo entero vive en JSON y no en tablas.
 */
export interface AutomationNode {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'delay';
  /** Clave del catálogo: `deal.won`, `assign_user`, `wait`… */
  key: string;
  config: Record<string, unknown>;
  /** Posición en el lienzo. Solo la usa el editor; el motor la ignora. */
  position?: { x: number; y: number };
}

/**
 * Arista dirigida entre dos nodos.
 *
 * `branch` distingue las dos salidas de una condición. En un nodo que no sea condición debe
 * ir ausente: una acción con dos salidas etiquetadas no significa nada y el validador la
 * rechaza antes de guardar.
 */
export interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  branch?: 'true' | 'false';
}

export interface AutomationGraph {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
}

/**
 * Automatización configurable: un disparador y el grafo que se ejecuta tras él.
 *
 * El reparto entre columna y JSON no es casual. `triggerType` e `isActive` son columnas
 * porque el motor los consulta en cada evento del sistema —"¿qué automatizaciones activas de
 * esta organización escuchan `deal.won`?"— y esa pregunta tiene que resolverse con un índice.
 * El grafo, en cambio, se lee siempre entero y nunca se consulta por dentro, así que
 * repartirlo en tablas solo agregaría uniones y migraciones sin comprar nada.
 *
 * No confundir con `workflow_templates`, que son listas de etapas de un proceso operativo
 * (onboarding, producción) y no ejecutan nada.
 */
@Entity('automations')
@Index('IDX_automations_org_trigger_active', ['organizationId', 'triggerType', 'isActive'])
export class Automation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'text', nullable: true }) description?: string | null;

  /** Evento que la dispara. Debe existir en el catálogo de disparadores. */
  @Column({ name: 'trigger_type', type: 'varchar', length: 60 }) triggerType: string;

  @Column({ name: 'is_active', type: 'boolean', default: false }) isActive: boolean;

  /**
   * Se incrementa en cada guardado del grafo.
   *
   * Cada ejecución anota con qué versión corrió: un trato que quedó esperando dos días no
   * debe terminar siguiendo un grafo que alguien editó mientras tanto.
   */
  @Column({ type: 'int', default: 1 }) version: number;

  @Column({ type: 'json' }) graph: AutomationGraph;

  /**
   * Identidad con la que actúa la automatización.
   *
   * Una automatización escribe sin que haya nadie autenticado detrás. Sin una identidad
   * declarada, todo lo que hiciera quedaría en la bitácora sin responsable y podría alcanzar
   * datos que su creador no puede ver. Se fija al crearla y queda registrada en cada efecto.
   */
  @Column({ name: 'run_as_user_id', type: 'uuid' }) runAsUserId: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
