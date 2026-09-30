import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

/** En qué punto está. Una campaña sólo avanza; de `ENVIADA` no se vuelve. */
export enum EstadoDeCampana {
  /** Escrita y no enviada. Se puede editar y borrar. */
  BORRADOR = 'draft',
  /** El envío empezó. Existe para que un segundo intento no vuelva a salir. */
  ENVIANDO = 'sending',
  /** Terminó. Queda como constancia de qué se mandó, a cuántos y cuándo. */
  ENVIADA = 'sent',
}

/**
 * Un correo escrito a mano y mandado a la lista de una empresa.
 *
 * Es la única comunicación del sistema que nadie pidió individualmente: el resto —confirmación de
 * reserva, clave temporal, saludo de cumpleaños— responde a algo que esa persona hizo. Por eso es
 * la que más rejas lleva, y la que siempre va con enlace de baja.
 *
 * Se guarda aunque ya se haya enviado, y no se borra: ante un reclamo hay que poder decir qué
 * texto salió, a qué lista, quién lo mandó y cuándo. El recuento se fija al enviar y no se
 * recalcula después, porque la lista cambia y la pregunta es a cuántos les llegó ese día.
 */
@Entity('email_campaigns')
@Index('IDX_email_campaigns_org_client', ['organizationId', 'clientId'])
export class Campana {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  /**
   * Empresa cuya lista recibe. Vacío es la lista de la agencia.
   *
   * Se fija al crear y no se puede cambiar: mover una campaña de empresa mandaría a una lista un
   * texto escrito para otra, y el permiso de cada lista se dio por separado.
   */
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string | null;

  @Column({ type: 'varchar', length: 200 }) asunto: string;

  /** Texto plano con `{{nombre}}`. La plantilla de la casa lo envuelve al componer. */
  @Column({ type: 'text' }) cuerpo: string;

  @Column({ type: 'varchar', length: 20, default: EstadoDeCampana.BORRADOR })
  estado: EstadoDeCampana;

  /** A cuántos se intentó escribir. Se fija al enviar. */
  @Column({ type: 'int', default: 0 }) destinatarios: number;

  /** A cuántos entró el envío. La diferencia con `destinatarios` son los que fallaron. */
  @Column({ type: 'int', default: 0 }) enviados: number;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true }) sentAt?: Date | null;

  /** Quién la mandó. Un envío sin responsable no se puede revisar después. */
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
