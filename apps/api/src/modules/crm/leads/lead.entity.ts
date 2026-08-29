import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate, Index } from 'typeorm';
import { Organization } from '../../organizations/organization.entity';
import { normalizePhone } from '../../../shared/phone';

@Entity('leads')
@Index('UQ_leads_org_external', ['organizationId', 'externalLeadId'], { unique: true })
// Cubren las consultas del inicio del CRM: por estado, por antigüedad y por responsable.
@Index('IDX_leads_org_status_updated', ['organizationId', 'status', 'updatedAt'])
@Index('IDX_leads_org_assigned', ['organizationId', 'assignedTo'])
// Los informes por período preguntan por la fecha de origen, no por la de ingreso.
@Index('IDX_leads_org_source_created', ['organizationId', 'sourceCreatedAt'])
export class Lead {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) email?: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) phone?: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) company?: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) source?: string;
  /**
   * A qué embudo pertenece este lead: `audience` (comensal que reservó vía un cliente
   * restaurante) o `commercial` (prospecto que quiere contratar a La Vitamina).
   *
   * Antes se inferia solo de `source` en cada consulta por separado (frágil: un `source`
   * mal escrito mezclaba dominios sin que nada lo detectara). Ahora se persiste una vez en
   * la captura (`LeadIntakeService`) y todo lo demás lo lee de acá.
   */
  @Column({ type: 'varchar', length: 20, default: 'commercial' }) domain: 'audience' | 'commercial';
  @Column({ name: 'source_detail', type: 'varchar', length: 255, nullable: true }) sourceDetail?: string | null;
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string | null;
  @Column({ type: 'json', nullable: true }) tags?: string[];
  @Column({ name: 'external_lead_id', type: 'varchar', length: 255, nullable: true }) externalLeadId?: string;
  @Column({ name: 'external_form_id', type: 'varchar', length: 255, nullable: true }) externalFormId?: string;
  @Column({ name: 'external_campaign_id', type: 'varchar', length: 255, nullable: true }) externalCampaignId?: string;
  @Column({ name: 'campaign_name', type: 'varchar', length: 255, nullable: true }) campaignName?: string | null;
  @Column({ name: 'page_id', type: 'varchar', length: 255, nullable: true }) pageId?: string;
  @Column({ type: 'varchar', length: 50, default: 'new' }) status: string;
  @Column({ name: 'fit_status', type: 'varchar', length: 50, default: 'review' }) fitStatus: string;
  @Column({ name: 'quality_score', type: 'int', default: 0 }) qualityScore: number;
  @Column({ name: 'traffic_light', type: 'varchar', length: 10, nullable: true })
  trafficLight?: 'green' | 'yellow' | 'red' | null;
  @Column({ name: 'discard_reason', type: 'text', nullable: true }) discardReason?: string;
  @Column({ name: 'assigned_to', type: 'uuid', nullable: true }) assignedTo?: string | null;
  @Column({ type: 'text', nullable: true }) notes?: string;
  @Column({ name: 'consent_captured_at', type: 'timestamp', nullable: true }) consentCapturedAt?: Date;
  /**
   * Fecha de nacimiento declarada por la propia persona.
   *
   * Sirve para felicitar y para no escribirle a quien declaró ser menor. **No acredita** la
   * edad —cualquiera puede poner otro año— pero deja constancia de que se preguntó, que es lo
   * proporcionado para una lista de correo.
   *
   * Solo la fecha, sin hora: guardar un instante haría que el cumpleaños cayera un día antes o
   * después según la zona horaria de quien consulte.
   */
  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate?: Date | null;
  @Column({ name: 'retention_review_at', type: 'timestamp', nullable: true }) retentionReviewAt?: Date;
  @Column({ type: 'json', nullable: true }) metadata?: Record<string, any>;
  @Column({ name: 'converted_at', type: 'timestamp', nullable: true }) convertedAt?: Date;
  @Column({ name: 'converted_to_client_id', type: 'uuid', nullable: true }) convertedToClientId?: string;
  /**
   * Monto estimado del negocio, en la moneda de la organización.
   *
   * Admite vacío: cero y «todavía no se sabe» son cosas distintas, y confundirlas hunde el ticket
   * promedio con negocios que sí valen pero nadie anotó.
   */
  @Column({ name: 'estimated_amount', type: 'decimal', precision: 14, scale: 2, nullable: true })
  estimatedAmount?: number | null;

  /**
   * Cuándo ocurrió el lead en su origen.
   *
   * Distinta de `createdAt`, que es cuándo entró al sistema. La brecha entre ambas es lo que
   * delata una integración atascada: un lead de Meta o de Make debería entrar en segundos.
   *
   * Vacía en los leads creados a mano, que no tienen origen externo.
   */
  @Column({ name: 'source_created_at', type: 'datetime', nullable: true })
  sourceCreatedAt?: Date | null;

  /**
   * Cuándo entró en la etapa en la que está.
   *
   * Distinta de `updatedAt`, que se mueve con cualquier edición: corregir un teléfono no es un
   * paso del embudo, y contarlo como tal hacía que el lead más manoseado no avisara nunca de
   * estar parado.
   *
   * Es lo que mide las alertas por inactividad. Vacía solo en los instantes previos a que la
   * migración la rellene.
   */
  @Column({ name: 'stage_changed_at', type: 'timestamp', nullable: true })
  stageChangedAt?: Date | null;

  /**
   * Hasta qué gravedad de inactividad se avisó ya de este lead.
   *
   * Evita repetir el mismo aviso en cada pasada del trabajo. Se limpia al cambiar de etapa: un
   * lead que avanzó y se vuelve a parar merece un aviso nuevo.
   */
  @Column({ name: 'idle_alerted_level', type: 'varchar', length: 10, nullable: true })
  idleAlertedLevel?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalize(): void {
    this.name = this.name?.trim();
    this.email = this.email?.trim().toLowerCase() || null;
    this.phone = normalizePhone(this.phone) ?? null;
    this.company = this.company?.trim() || null;
    this.source = this.source?.trim() || undefined;
    this.sourceDetail = this.sourceDetail?.trim() || null;
    this.campaignName = this.campaignName?.trim() || null;
    this.notes = this.notes?.trim() || undefined;
  }
}
