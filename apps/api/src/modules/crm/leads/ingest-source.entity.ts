import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Origen desde el que entran leads por integración, con su propia llave.
 *
 * **Una llave por origen y no una compartida.** Con una sola, filtrarse obliga a rotarla en
 * todas partes a la vez y a reconfigurar cada Zap; con una por origen se revoca la afectada y
 * las demás siguen recibiendo. Además el origen queda determinado por la llave y no por lo que
 * mande quien llama, así que nadie puede declararse «Meta Ads» desde otro lado.
 *
 * `receivedCount` y `lastReceivedAt` no son adorno: convierten «no me llegan los leads» en un
 * diagnóstico de dos segundos —se ve cuál conexión está viva y cuál nunca se usó— sin abrir un
 * registro del servidor.
 *
 * Los leads de Meta **no pasan por acá**: entran directo con su firma verificada
 * (`X-Hub-Signature-256`), que es una garantía más fuerte que una llave compartida. Esta puerta
 * es para lo que no puede firmar: portales, formularios de terceros y automatizaciones.
 */
@Entity('lead_ingest_sources')
@Index('UQ_lead_ingest_sources_token', ['tokenHash'], { unique: true })
@Index('IDX_lead_ingest_sources_org', ['organizationId', 'isActive'])
export class LeadIngestSource {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  /** Cliente al que se asignan los leads de este origen. */
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string | null;

  /** Nombre visible: «Portal inmobiliario», «WhatsApp», «Formulario del sitio». */
  @Column({ type: 'varchar', length: 120 }) name: string;

  /** Valor que queda guardado en el lead como su procedencia. */
  @Column({ type: 'varchar', length: 60 }) source: string;

  /**
   * Campaña a la que pertenece esta llave.
   *
   * Cuando la tiene, manda sobre lo que traiga el cuerpo: quien configura el escenario no puede
   * equivocarse al escribir el nombre, y el costo por lead deja de depender de eso.
   */
  @Column({ name: 'campaign_name', type: 'varchar', length: 180, nullable: true }) campaignName?: string | null;

  /**
   * Huella de la llave, nunca la llave.
   *
   * Se guarda el hash por la misma razón que una contraseña: quien lea la base no debe poder
   * usar la integración. La llave se muestra **una sola vez**, al crearla; después solo se puede
   * rotar, no recuperar.
   */
  @Column({ name: 'token_hash', type: 'varchar', length: 64 }) tokenHash: string;

  /** Últimos caracteres, para reconocerla en la pantalla sin revelarla. */
  @Column({ name: 'token_hint', type: 'varchar', length: 12 }) tokenHint: string;

  /** Apagar corta este origen sin borrar su historial ni tocar los demás. */
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;

  @Column({ name: 'received_count', type: 'int', default: 0 }) receivedCount: number;
  @Column({ name: 'last_received_at', type: 'datetime', nullable: true }) lastReceivedAt?: Date | null;

  /**
   * Último rechazo, para que la pantalla explique por qué no entra un lead.
   *
   * Sin esto, una integración mal configurada se ve igual que una que nadie usó todavía: ambas
   * con el contador en cero.
   */
  @Column({ name: 'last_error', type: 'varchar', length: 300, nullable: true }) lastError?: string | null;
  @Column({ name: 'last_error_at', type: 'datetime', nullable: true }) lastErrorAt?: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
