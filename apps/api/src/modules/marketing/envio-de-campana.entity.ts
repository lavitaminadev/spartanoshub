import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * Un correo de campaña pendiente de salir, o ya salido, para una persona concreta.
 *
 * Una fila por destinatario y no por campaña. Tres razones, y la tercera es la que manda:
 *
 * 1. El lote se acota por filas, que es lo que cabe en el minuto que da el `curl` del cron.
 * 2. Un rebote reintenta sólo a esa persona, no a la campaña entera.
 * 3. **Queda constancia de a quién le llegó y a quién no.** Todo este módulo existe para poder
 *    demostrar quién consintió qué; un envío que sólo guardara «181 de 184» no responde a un
 *    reclamo individual, que es la pregunta que de verdad llega.
 *
 * Por eso tampoco se limpia con el `cleanup` de la bandeja: las demás borran lo procesado a los
 * siete días porque su valor se acaba al entregar, y el de éstas empieza ahí.
 */
@Entity('email_campaign_sends')
// La consulta de cada pasada del cron: qué está listo para salir.
@Index('IDX_email_campaign_sends_status', ['status', 'nextAttemptAt'])
// El avance de una campaña, que es lo que mira la pantalla mientras sale.
@Index('IDX_email_campaign_sends_campana', ['campanaId', 'status'])
/*
 * Una fila por campaña y persona.
 *
 * Es lo que impide que un segundo encolado —dos clics, un reintento del navegador— duplique los
 * destinatarios. El botón ya se guarda de eso, pero esto lo hace imposible en vez de improbable.
 */
@Index('UQ_email_campaign_sends_campana_suscriptor', ['campanaId', 'suscriptorId'], { unique: true })
export class EnvioDeCampana {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  @Column({ name: 'campana_id', type: 'uuid' }) campanaId: string;

  @Column({ name: 'suscriptor_id', type: 'uuid' }) suscriptorId: string;

  /**
   * La dirección a la que se escribió, congelada al encolar.
   *
   * Se guarda aquí y no se lee de la ficha al enviar porque la ficha puede cambiar o borrarse
   * —la Ley 21.719 da derecho a ello— y entonces la constancia diría a quién *no* se escribió.
   * Lo que hay que poder responder es a qué dirección salió ese correo aquel día.
   */
  @Column({ type: 'varchar', length: 190 }) email: string;

  /** `pending`, `retry`, `processing`, `processed`, `failed` o `expired`. */
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: string;

  @Column({ type: 'int', default: 0 }) attempts: number;

  @Column({ name: 'next_attempt_at', type: 'timestamp', nullable: true }) nextAttemptAt?: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true }) lastError?: string | null;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true }) processedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
