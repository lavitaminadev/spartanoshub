import {
  BeforeInsert, BeforeUpdate, Column, CreateDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * Estado de una dirección respecto a recibir correo comercial.
 *
 * Tres y no dos, porque «todavía no ha dicho que sí» y «dijo que no» son cosas distintas: a la
 * primera se le puede preguntar una vez, a la segunda no se le puede escribir nunca más.
 */
export enum EstadoDeSuscripcion {
  /** Está en la lista pero nadie le ha preguntado. No se le puede enviar campaña. */
  PENDIENTE = 'pending',
  /** Dijo que sí, y consta cuándo y a qué texto. */
  SUSCRITO = 'subscribed',
  /** Se dio de baja o dijo que no. Definitivo. */
  BAJA = 'unsubscribed',
}

/**
 * Una dirección de correo a la que la agencia puede escribir, y la prueba de que puede.
 *
 * Existe separada de leads, contactos y reservas a propósito. Quien reservó una mesa dio su
 * correo **para que le confirmes la reserva**, no para recibir promociones: son dos permisos
 * distintos y mezclarlos convierte una base de clientes en una lista de envío que nadie autorizó.
 * Aquí solo entra quien puede recibir campañas, y con qué respaldo.
 *
 * Cada fila guarda de dónde salió, cuándo y ante qué texto se consintió. No es burocracia: la
 * Ley 19.628 y lo que venga a reemplazarla exigen poder demostrar el origen de cada dirección, y
 * «estaba en un Excel» no es una respuesta. Sin ese respaldo el estado nace en `PENDIENTE` y no
 * se le manda nada.
 */
@Entity('email_subscribers')
// Una dirección por organización. El correo es la identidad acá: la misma persona en dos filas
// recibiría la campaña dos veces y podría estar suscrita en una y de baja en la otra.
@Index('UQ_email_subscribers_org_email', ['organizationId', 'email'], { unique: true })
// El envío pregunta «quién está suscrito en esta organización», y es la consulta de cada campaña.
@Index('IDX_email_subscribers_org_status', ['organizationId', 'status'])
// La baja se resuelve por el token del enlace, sin sesión.
@Index('IDX_email_subscribers_token', ['unsubscribeToken'])
export class Suscriptor {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  /**
   * Empresa a la que pertenece, cuando la lista es de un cliente y no de la agencia.
   *
   * Vacío significa «de la agencia». Sin esta separación, una campaña de un cliente saldría a la
   * lista de otro.
   */
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string | null;

  @Column({ type: 'varchar', length: 190 }) email: string;

  @Column({ type: 'varchar', length: 180, nullable: true }) name?: string | null;

  @Column({ type: 'varchar', length: 20, default: EstadoDeSuscripcion.PENDIENTE })
  status: EstadoDeSuscripcion;

  /**
   * De dónde salió esta dirección.
   *
   * Texto libre y no una lista cerrada porque los orígenes aparecen antes que el código que los
   * contempla: `google_forms`, `landing_verano`, `csv_evento_marzo`. Lo que no puede faltar es
   * que **haya** algo: una dirección sin procedencia no se puede defender.
   */
  @Column({ type: 'varchar', length: 120 }) source: string;

  /** Detalle del origen: el nombre del formulario, el archivo importado, la campaña. */
  @Column({ name: 'source_detail', type: 'varchar', length: 255, nullable: true })
  sourceDetail?: string | null;

  /**
   * Cuándo consintió, y ante qué texto.
   *
   * El texto se guarda entero y no una versión: dentro de dos años, «aceptó la v3» no le dice
   * nada a nadie, y lo que hay que poder mostrar es exactamente lo que la persona leyó.
   */
  @Column({ name: 'consent_at', type: 'timestamp', nullable: true }) consentAt?: Date | null;

  @Column({ name: 'consent_text', type: 'text', nullable: true }) consentText?: string | null;

  /**
   * Dirección desde la que se consintió, cuando se capturó por web.
   *
   * Es lo que convierte «dijo que sí» en algo comprobable. Vacío en las importaciones, donde el
   * respaldo es el archivo y no una petición.
   */
  @Column({ name: 'consent_ip', type: 'varchar', length: 45, nullable: true })
  consentIp?: string | null;

  @Column({ name: 'unsubscribed_at', type: 'timestamp', nullable: true })
  unsubscribedAt?: Date | null;

  /**
   * Token del enlace de baja.
   *
   * Va en cada correo y permite darse de baja sin iniciar sesión, que es como tiene que ser: una
   * baja que exige recordar una contraseña no es una baja. Es aleatorio y no derivado del correo,
   * para que nadie pueda dar de baja a otra persona probando direcciones.
   */
  @Column({ name: 'unsubscribe_token', type: 'varchar', length: 64, unique: true })
  unsubscribeToken: string;

  /** Cuándo se le mandó el último correo. Evita repetir una campaña sobre la misma gente. */
  @Column({ name: 'last_sent_at', type: 'timestamp', nullable: true })
  lastSentAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  /**
   * El correo se guarda siempre en minúsculas y sin espacios.
   *
   * Es la clave de unicidad: sin normalizar, `Ana@x.cl` y `ana@x.cl` entran como dos personas,
   * reciben la campaña dos veces, y darse de baja en una deja la otra activa.
   */
  @BeforeInsert()
  @BeforeUpdate()
  normalizar(): void {
    this.email = this.email?.trim().toLowerCase();
    this.name = this.name?.trim() || null;
  }

  /** Si se le puede enviar una campaña ahora mismo. */
  puedeRecibirCampana(): boolean {
    return this.status === EstadoDeSuscripcion.SUSCRITO;
  }
}
