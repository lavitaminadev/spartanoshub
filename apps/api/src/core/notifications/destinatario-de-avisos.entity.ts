import {
  BeforeInsert, BeforeUpdate, Column, CreateDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * Los tipos de aviso que se pueden repartir, y qué correo es cada uno.
 *
 * Existen como lista cerrada porque cada uno lleva datos distintos de un tercero: el de grupos
 * lleva el teléfono y lo que contó quien pidió el evento; el de reservas, sólo el nombre y la hora.
 * Mandarlos todos a las mismas direcciones obligaba a darle el teléfono del cliente a quien sólo
 * necesita saber que a las nueve entran seis personas.
 */
export const TIPOS_DE_AVISO = {
  reservas: { etiqueta: 'Reserva nueva', plantilla: 'email.team_new_reservation' },
  grupos: { etiqueta: 'Solicitud de grupo o evento', plantilla: 'email.team_group_request' },
  espera: { etiqueta: 'Lista de espera', plantilla: 'email.team_waitlist' },
  cambios: { etiqueta: 'El cliente canceló o cambió la hora', plantilla: 'email.team_guest_cancel' },
  encuestas: { etiqueta: 'Mensaje en una encuesta', plantilla: 'email.team_survey_message' },
  operacion: { etiqueta: 'Reservas pausadas o día cerrado', plantilla: null },
} as const;

export type TipoDeAviso = keyof typeof TIPOS_DE_AVISO;

/** Los tipos válidos, para comprobar lo que llega de fuera. */
export const TIPOS_DE_AVISO_VALIDOS = Object.keys(TIPOS_DE_AVISO) as TipoDeAviso[];

/**
 * Una casilla del equipo del local que recibe avisos, con o sin cuenta en el sistema.
 *
 * Nace porque un garzón, un cajero o un barra no tienen por qué tener usuario: reciben un aviso y
 * hacen su trabajo. Antes las direcciones vivían en un campo de texto del **formulario de reservas**
 * —`teamNotifications`— y eso traía tres problemas que esta tabla resuelve:
 *
 * 1. Eran del formulario, no del local: dos formularios en el mismo local obligaban a mantener la
 *    misma lista dos veces, y olvidar una dejaba a alguien sin avisos sin que se notara.
 * 2. Un solo balde: todos recibían todo, incluido el teléfono y las notas de quien pedía un evento.
 * 3. Sin constancia. El correo de un trabajador es un dato personal suyo; tenerlo en una lista sin
 *    saber quién lo agregó ni cuándo no se puede explicar, y la Ley 21.719 pregunta justamente eso.
 *
 * Lo antiguo sigue funcionando: quien tenga direcciones en el formulario las recibe todas, como
 * hasta ahora, hasta que se pasen aquí. Nada se borra por migrar.
 */
@Entity('team_notification_recipients')
/*
 * Una dirección por local. La misma persona puede estar en dos locales con distintos avisos en
 * cada uno —el encargado de turno de uno no tiene por qué enterarse de lo del otro—.
 */
@Index('UQ_team_recipients_org_client_email', ['organizationId', 'clientId', 'email'], { unique: true })
export class DestinatarioDeAvisos {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  /** El local. Nunca vacío: un aviso de operación sin local no tiene a quién pertenecer. */
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;

  @Column({ type: 'varchar', length: 190 }) email: string;

  @Column({ type: 'varchar', length: 120, nullable: true }) name?: string | null;

  /**
   * Para qué está en el local: «garzón», «cajera», «encargado de turno».
   *
   * Texto libre y no una lista cerrada: los cargos de un local no caben en un catálogo escrito
   * desde fuera. Sirve para que quien mantenga la lista entienda a quién está quitando.
   */
  @Column({ type: 'varchar', length: 80, nullable: true }) cargo?: string | null;

  /**
   * Qué avisos recibe. Vacío no recibe nada, y es un estado legítimo: se deja de mandar sin borrar
   * la fila, que es lo que permite volver a activarla sin volver a pedir la dirección.
   */
  @Column({ type: 'json', nullable: true }) tipos?: string[] | null;

  /** Quién la agregó. Una dirección sin responsable no se puede explicar después. */
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  /** En minúsculas y sin espacios: es la clave de unicidad y sin normalizar entra dos veces. */
  @BeforeInsert()
  @BeforeUpdate()
  normalizar(): void {
    this.email = this.email?.trim().toLowerCase();
    this.name = this.name?.trim() || null;
    this.cargo = this.cargo?.trim() || null;
  }

  /** Si le toca este aviso. */
  recibe(tipo: TipoDeAviso): boolean {
    return Array.isArray(this.tipos) && this.tipos.includes(tipo);
  }
}
