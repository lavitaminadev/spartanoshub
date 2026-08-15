import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Ciclo de vida de un tipo de pieza.
 *
 * Un tipo no entra en producción por existir: alguien lo propone, alguien con atribución lo
 * aprueba, y recién ahí aparece en los formularios. Ese paso es lo que impide que el catálogo
 * con el que se le cobra al cliente se llene de tipos duplicados o mal valorados.
 */
export enum PieceTypeStatus {
  /** Se está redactando. No aparece en ningún formulario. */
  DRAFT = 'draft',
  /** Propuesto y esperando a quien tenga la atribución de aprobarlo. */
  PENDING_APPROVAL = 'pending_approval',
  /** Aprobado y en uso: aparece en los formularios y descuenta presupuesto. */
  ACTIVE = 'active',
  /** Ya no se ofrece. Las piezas que lo usaron conservan su tipo y su cobro. */
  RETIRED = 'retired',
}

/** Área que produce el tipo, que es lo que decide en qué vista aparece. */
export enum PieceTypeArea {
  DESIGN = 'design',
  AUDIOVISUAL = 'audiovisual',
}

/**
 * Un tipo de pieza como dato, no como código.
 *
 * Antes los tipos eran un `enum` de TypeScript: agregar uno exigía cambiar el repositorio,
 * compilar y desplegar. Eso ataba una decisión del negocio —qué se produce y cuánto vale— al
 * calendario técnico, y obligaba a que alguien con acceso al código estuviera disponible cada
 * vez que el área inventaba un formato.
 *
 * Como fila, un tipo se propone desde la aplicación, se aprueba con atribución, y desde ese
 * momento aparece en los formularios de su área. Sin reinicio y sin despliegue.
 *
 * El `enum` no desaparece: sigue siendo la semilla con la que nace el catálogo de cada
 * organización y el nombre estable con el que el código se refiere a los tipos que ya conocía.
 * Lo que cambia es que deja de ser la única fuente posible.
 */
@Entity('piece_type_definitions')
@Index('UQ_piece_type_org_key', ['organizationId', 'key'], { unique: true })
export class PieceTypeDefinition {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  /**
   * Identificador estable del tipo, en minúsculas con guion bajo.
   *
   * No cambia nunca, aunque cambie la etiqueta: las piezas ya creadas guardan esta clave y
   * renombrarla las dejaría apuntando a un tipo inexistente.
   */
  @Column({ type: 'varchar', length: 50 }) key: string;

  /** Nombre visible. Este sí se puede corregir sin romper nada. */
  @Column({ type: 'varchar', length: 100 }) label: string;

  @Column({ type: 'varchar', length: 20, default: PieceTypeArea.DESIGN }) area: PieceTypeArea;

  /**
   * Unidades que descuenta del presupuesto del cliente.
   *
   * `null` es un tipo aprobado para producirse pero sin precio decidido: se registra el trabajo
   * y no se descuenta nada. Es visible y corregible; cobrar una cifra que nadie eligió no lo es.
   */
  @Column({ name: 'ud_amount', type: 'decimal', precision: 8, scale: 2, nullable: true }) udAmount?: number | null;

  /**
   * Multiplicador del XP que gana quien lo produce, sobre la base de su nivel de dificultad.
   *
   * Es un eje distinto de las unidades a propósito: las unidades son lo que se le cobra al
   * cliente y el XP es el mérito de quien hizo el trabajo. Unirlos daría incentivo a empujar los
   * trabajos caros por encima de los difíciles.
   */
  @Column({ name: 'xp_weight', type: 'decimal', precision: 5, scale: 2, default: 1 }) xpWeight: number;

  /** Si la pieza se cobra por tramos: un valor base más un extra por cada elemento adicional. */
  @Column({ name: 'extra_per_unit', type: 'decimal', precision: 8, scale: 2, nullable: true }) extraPerUnit?: number | null;

  /** Va a imprenta, que es como Arte gradúa hoy el esfuerzo. */
  @Column({ name: 'is_print', type: 'boolean', default: false }) isPrint: boolean;

  @Column({ type: 'varchar', length: 20, default: PieceTypeStatus.DRAFT }) status: PieceTypeStatus;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true }) requestedBy?: string;
  @Column({ name: 'approved_by', type: 'uuid', nullable: true }) approvedBy?: string;
  @Column({ name: 'approved_at', type: 'timestamp', nullable: true }) approvedAt?: Date;

  /** Por qué se propuso o por qué se rechazó, para que la decisión quede explicada. */
  @Column({ type: 'varchar', length: 500, nullable: true }) notes?: string;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
