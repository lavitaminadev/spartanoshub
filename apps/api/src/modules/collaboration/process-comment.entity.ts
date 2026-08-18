import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * A qué se le está comentando.
 *
 * Un solo hilo sirve a las tres áreas porque el trabajo cambia de forma según dónde ocurra —una
 * pieza en Arte, una sesión en Audiovisual, una solicitud antes de convertirse en cualquiera de
 * las dos— pero la conversación alrededor es la misma cosa. Tener un hilo por módulo obligaría a
 * escribir tres veces la misma lógica de permisos, edición y retención.
 */
export enum CommentSubject {
  PIECE = 'piece',
  SESSION = 'session',
  WORK_REQUEST = 'work_request',
  /**
   * Prospecto y trato del embudo comercial.
   *
   * Se suman al mismo hilo y no a una tabla propia del CRM por la razón que ya justificaba
   * unir las tres áreas: la conversación alrededor del trabajo es la misma cosa, cambie el
   * trabajo de forma. Un hilo aparte para lo comercial obligaría a reescribir la visibilidad
   * hacia el cliente, el congelado del autor y la despersonalización por retención, que acá
   * ya están resueltos.
   *
   * La visibilidad `client` conserva su significado y gana uno nuevo: en una pieza distingue
   * al equipo del cliente que revisa; en un trato distingue la nota interna de lo que el
   * prospecto podría llegar a ver. Ante la duda el valor por defecto sigue siendo `internal`.
   */
  LEAD = 'lead',
  OPPORTUNITY = 'opportunity',
}

/**
 * Quién puede leer el comentario.
 *
 * Los dos flujos son distintos y no deben mezclarse: lo que el equipo anota mientras trabaja no
 * es lo mismo que lo que el cliente escribe al revisar. Distinto autor, distinta visibilidad y
 * distinto efecto —una observación de proceso no cuenta como ronda de corrección, un rechazo del
 * cliente sí—. Guardarlos juntos y separarlos al mostrarlos sería una filtración esperando a un
 * error de consulta.
 */
export enum CommentVisibility {
  /** Solo el equipo de la agencia. El cliente nunca lo ve. */
  INTERNAL = 'internal',
  /** Parte de la conversación con el cliente, visible en su portal. */
  CLIENT = 'client',
}

/**
 * Comentario de proceso sobre un trabajo.
 *
 * Es la bitácora de trabajo que faltaba: hasta ahora lo único que se guardaba era la corrección
 * —un pedido de cambio con su origen— y no había dónde dejar lo que se va observando mientras se
 * produce. Eso obligaba a que las decisiones vivieran en WhatsApp, donde nadie las encuentra
 * después y no quedan asociadas al trabajo.
 *
 * No se borra ni se reescribe: editar deja marca y el texto anterior queda en la bitacora de
 * auditoría. Un hilo que se puede alterar sin rastro no sirve para explicar por qué algo se
 * decidió, que es justamente para lo que se quiere.
 */
@Entity('process_comments')
@Index('IDX_process_comment_subject', ['organizationId', 'subjectType', 'subjectId', 'createdAt'])
export class ProcessComment {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  @Column({ name: 'subject_type', type: 'varchar', length: 20 }) subjectType: CommentSubject;
  @Column({ name: 'subject_id', type: 'uuid' }) subjectId: string;

  @Column({ name: 'author_id', type: 'uuid', nullable: true }) authorId?: string | null;

  /**
   * Cargo del autor cuando escribió, copiado a propósito.
   *
   * El cargo de una persona cambia, y leer el hilo un año después con el cargo actual haría
   * parecer que una decisión la tomó alguien que entonces no tenía esa atribución.
   */
  @Column({ name: 'author_role', type: 'varchar', length: 40, nullable: true }) authorRole?: string | null;

  /** Nombre mostrado, congelado igual que el cargo y por la misma razón. */
  @Column({ name: 'author_name', type: 'varchar', length: 120, nullable: true }) authorName?: string | null;

  @Column({ type: 'text' }) body: string;

  @Column({ type: 'varchar', length: 20, default: CommentVisibility.INTERNAL }) visibility: CommentVisibility;

  /** Cuándo se editó por última vez; `null` es un comentario que nunca se tocó. */
  @Column({ name: 'edited_at', type: 'timestamp', nullable: true }) editedAt?: Date | null;

  /**
   * Cuándo se despersonalizó por retención.
   *
   * El comentario no se borra: se le quita el texto y la identidad del autor y se conserva la
   * fila. Así las métricas del trabajo —cuántas observaciones tuvo, en qué momentos, de qué
   * áreas— sobreviven sin que quede dato personal, que es lo que la ley protege.
   */
  @Column({ name: 'anonymized_at', type: 'timestamp', nullable: true }) anonymizedAt?: Date | null;

  /** Con milisegundos: dos comentarios del mismo segundo tienen que ordenarse igual siempre. */
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
