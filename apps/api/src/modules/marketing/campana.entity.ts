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

  /**
   * A quién va. Decide de dónde salen las direcciones y qué permiso las respalda.
   *
   * - `lista`: los suscritos de la empresa de `clientId`, o los de la agencia si va vacío. Su
   *   respaldo es el permiso de marketing que esa persona le dio **a esa empresa**.
   * - `administradores`: las cuentas que administran cada empresa. No es publicidad sino aviso de
   *   servicio a quien contrató, así que no exige permiso de marketing ni lleva enlace de baja:
   *   nadie se da de baja de que le cuenten cómo va el servicio que paga.
   * No hay «escribir direcciones a mano» acá, y es a propósito: una dirección sin procedencia no
   * se puede defender ante «de dónde sacaron mi correo», que es la primera pregunta de cualquier
   * reclamo. Para eso está Importar, que exige declarar de dónde salió y deja constancia; una vez
   * importadas, entran a la lista y esta campaña las alcanza como a cualquier otra.
   *
   * Tampoco hay «todas las listas»: quien aceptó promociones de Casa Costanera se las dio **a Casa
   * Costanera**, no a Espartanos ni a Bar Ruperto. Mandarle a todas de una vez usaría un permiso
   * dado para una cosa en otra. Hace falta antes una casilla propia para eso.
   */
  @Column({ type: 'varchar', length: 20, default: 'lista' })
  destino: 'lista' | 'administradores';

  @Column({ type: 'varchar', length: 200 }) asunto: string;

  /** Texto plano con `{{nombre}}`. La plantilla de la casa lo envuelve al componer. */
  @Column({ type: 'text' }) cuerpo: string;

  /**
   * Cupón que acompaña la campaña, si lleva uno.
   *
   * Se guarda el código y no una referencia: el cupón puede desactivarse o vencer después, y
   * entonces la campaña ya no diría qué se ofreció ese día. Ante un reclamo —«me prometieron un
   * descuento»— hay que poder leerlo aquí.
   *
   * Al escribirlo se comprueba con las mismas reglas que el cupón de después de la visita: que
   * exista, que sea de esta misma empresa, que esté activo y que no haya vencido. Un cupón de otra
   * empresa o vencido es un descuento que la caja va a rechazar delante del cliente.
   */
  @Column({ type: 'varchar', length: 40, nullable: true }) cupon?: string | null;

  /** Hasta cuándo vale, copiado al enviar: el correo tiene que poder decirlo. */
  @Column({ name: 'cupon_vence', type: 'timestamp', nullable: true }) cuponVence?: Date | null;

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
