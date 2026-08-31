import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { AuditService } from '../../../core/audit/audit.service';
import { Lead } from './lead.entity';
import { LeadFitStatus } from './lead-fit-status.enum';
import { LeadStatus, isStatusInDomain } from './lead-status.enum';
import { CrmLeadAutomationService } from './crm-lead-automation.service';
import { Contact } from '../contacts/contact.entity';
import { normalizePhone } from '../../../shared/phone';

const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'yahoo.com',
  'live.com',
]);

const HIGH_INTENT_KEYWORDS = [
  'presupuesto',
  'cotizacion',
  'cotización',
  'reunion',
  'reunión',
  'agendar',
  'campana',
  'campaña',
  'marketing',
  'publicidad',
  'ads',
  'ventas',
  'clientes',
  'reserva',
  'restaurante',
  'clinica',
  'clínica',
];

const LOW_QUALITY_KEYWORDS = [
  'trabajo',
  'empleo',
  'practica',
  'práctica',
  'curriculum',
  'currículum',
  'proveedor',
  'factura',
  'spam',
  'prueba',
  'test',
  'soporte',
];

export interface LeadMetadata {
  scoringSignals?: string[];
  [key: string]: string | number | boolean | string[] | Record<string, unknown> | Record<string, unknown>[] | undefined;
}

/**
 * Dominio al que pertenece la captura.
 *
 * `commercial` es una organización que puede convertirse en cliente de Espartanos: se le aplica
 * el scoring comercial y, si califica, la automatización que abre contacto y oportunidad.
 *
 * `audience` es una persona que reservó en el local de un cliente. Nunca es una venta, así que
 * no se le aplica scoring comercial ni se le abre oportunidad; solo se asegura su contacto.
 */
export type LeadDomain = 'commercial' | 'audience';

/**
 * Qué puede hacer una captura sobre un lead que ya existe.
 *
 * `upsert` — reconoce a la persona por correo, teléfono o identificador externo y actualiza
 * sus datos. Es lo que corresponde a los orígenes de confianza: el webhook firmado de Meta,
 * las reservas creadas por el sistema y el alta manual de un usuario autenticado.
 *
 * `create-only` — nunca escribe sobre un lead existente; solo crea. Es lo que corresponde a
 * un origen anónimo, donde quien envía el formulario no ha probado ser la persona cuyos datos
 * pisaría. En este modo `externalLeadId` actúa únicamente como guardia contra reenvíos: si ya
 * hay una captura con esa clave, se devuelve tal cual y no se toca nada.
 */
export type LeadCaptureMode = 'upsert' | 'create-only';

export interface LeadCaptureInput {
  organizationId: string;
  clientId?: string;
  /** Dominio de la captura. Por defecto `commercial`, que preserva el comportamiento previo. */
  domain?: LeadDomain;
  name: string;
  /**
   * La captura la escribió una persona con sesión, no un origen automático.
   *
   * Cambia el resultado del scoring: un prospecto anotado a mano nunca se descarta solo. Ver
   * `qualifyLead`.
   */
  enteredByPerson?: boolean;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  sourceDetail?: string;
  notes?: string;
  estimatedAmount?: number;
  trafficLight?: 'green' | 'yellow' | 'red';
  /**
   * Cuándo ocurrió en el origen. Vacío cuando no hay origen externo que lo aporte.
   *
   * Se propaga tal cual y no se rellena con la hora actual: suponerla borraría la distinción
   * entre cuándo llegó la gente y cuándo la integración logró entregarla.
   */
  sourceCreatedAt?: Date;
  externalLeadId?: string;
  externalFormId?: string;
  externalFormName?: string;
  externalCampaignId?: string;
  campaignName?: string;
  pageId?: string;
  status?: string;
  tags?: string[];
  consentCapturedAt?: Date;
  metadata?: LeadMetadata;
}

/** Resultado de buscar una captura previa de la misma persona. */
interface LeadMatch {
  lead: Lead | null;
  matchedBy?: 'externalLeadId' | 'phone' | 'email';
  conflict?: { otherLeadId: string; otherMatchedBy: 'phone' | 'email' };
}

interface LeadQualificationResult {
  qualityScore: number;
  fitStatus: LeadFitStatus;
  discardReason?: string;
  scoringSignals: string[];
}

@Injectable()
export class LeadIntakeService {
  /**
   * Antigüedad máxima que Meta acepta para un evento, en días.
   *
   * Es su límite, no una decisión nuestra: un evento más viejo se descarta, y falsear la fecha
   * para colarlo puede costar el lote completo.
   */
  private static readonly DIAS_QUE_META_ACEPTA = 7;

  /**
   * Plazo por omisión para revisar la retención de un lead, en días.
   *
   * Veinticuatro meses desde la captura. Un prospecto que nadie movió en dos años ya no sirve
   * al fin para el que se recogió, y ese fin es lo que la ley mide.
   */
  private static readonly DIAS_DE_RETENCION_POR_OMISION = 730;

  private readonly logger = new Logger(LeadIntakeService.name);

  constructor(
    @InjectRepository(Lead) private readonly repo: Repository<Lead>,
    private readonly automation: CrmLeadAutomationService,
    private readonly audit: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Captura a una persona que reservó y devuelve su contacto de audiencia.
   *
   * La reserva guarda el identificador del contacto para no tener que reconstruir el vínculo
   * cruzando teléfonos más adelante.
   */
  async captureAudience(input: Omit<LeadCaptureInput, 'domain'>): Promise<{ lead: Lead; contact: Contact | null }> {
    return this.capture({ ...input, domain: 'audience' });
  }

  /**
   * Captura una persona u organización y devuelve el lead resultante.
   *
   * Se conserva por compatibilidad con quienes solo necesitan el lead.
   *
   * @param mode - `create-only` para orígenes anónimos, donde la captura jamás puede escribir
   * sobre un lead existente. Por defecto `upsert`, reservado a los orígenes de confianza.
   */
  async captureLead(input: LeadCaptureInput, mode: LeadCaptureMode = 'upsert'): Promise<Lead> {
    const { lead } = await this.capture(input, mode);
    return lead;
  }

  /**
   * Implementación común. Devuelve también el contacto para que el llamador pueda vincularlo,
   * en vez de exponerlo en un campo compartido del servicio: dos reservas simultáneas se
   * pisarían ese campo entre los `await` de la transacción.
   */
  private async capture(input: LeadCaptureInput, mode: LeadCaptureMode = 'upsert'): Promise<{ lead: Lead; contact: Contact | null }> {
    const { domain, payload } = this.splitDomain(input);
    const normalized = this.normalizeInput(payload);
    const transactionManager = this.repo.manager;

    // Sin transacción disponible se persiste igual, con el mismo procedimiento. Los dos caminos
    // llaman al mismo método a propósito: cuando eran dos copias, la auditoría de sobrescritura
    // se agregó solo a una y el camino sin transacción siguió pisando datos en silencio.
    if (!transactionManager?.transaction) {
      const directo = await this.persistCapture(normalized, domain, this.repo, undefined, mode);
      this.anunciarLlegada(directo.lead, domain);
      return directo;
    }

    const resultado = await transactionManager.transaction(async (manager) =>
      this.persistCapture(normalized, domain, manager.getRepository(Lead), manager, mode));
    this.anunciarLlegada(resultado.lead, domain);
    return resultado;
  }

  /**
   * Anuncia que llegó un lead comercial, para que quien reporte a Meta lo sepa.
   *
   * Es la primera etapa del embudo y la que todos recorren: la integración calcula la tasa de
   * conversión sobre ella, así que sin este aviso las calificaciones y ventas llegan sin
   * denominador y el embudo no se puede validar.
   *
   * **Solo el dominio comercial.** Una reserva no es un prospecto del CRM y tiene sus propios
   * eventos; mezclarlas metería a los comensales en el embudo de ventas de la agencia.
   *
   * **Solo lo que llega de verdad ahora.** Un lead importado trae su fecha de origen real, y
   * Meta descarta lo que supere los siete días —advirtiendo que un lote con fechas
   * manipuladas puede desecharse entero—. Cargar el histórico no puede anunciarse como si
   * acabara de ocurrir: sería falso y arriesgaría los eventos legítimos del mismo lote.
   *
   * Va fuera de la transacción a propósito: quien escucha lee el lead por su cuenta, y dentro
   * de la transacción todavía no lo vería.
   */
  private anunciarLlegada(lead: Lead, domain: LeadDomain): void {
    if (domain !== 'commercial') return;

    const origen = lead.sourceCreatedAt ?? lead.createdAt;
    const dias = origen ? (Date.now() - new Date(origen).getTime()) / 86_400_000 : 0;
    if (dias > LeadIntakeService.DIAS_QUE_META_ACEPTA) return;

    this.eventEmitter.emit('lead.received', {
      organizationId: lead.organizationId,
      leadId: lead.id,
      clientId: lead.clientId ?? null,
    });
  }

  /**
   * Escribe la captura: reconoce a la persona si ya existe, la puntúa y deja rastro.
   *
   * Los datos de identidad de un lead existente se pisan con los que llegan. Esa ruta se dispara
   * desde los webhooks de Meta y desde el formulario público —endpoints **sin usuario
   * autenticado**, que por tanto no pasan por el interceptor de auditoría—, así que la
   * sobrescritura se registra explícitamente acá. Sin eso, un reenvío de formulario con el
   * teléfono mal escrito lo cambiaba de forma permanente y sin dejar rastro de cuál era el
   * anterior.
   *
   * En `create-only` nada de eso ocurre: la captura no busca a quién parecerse, así que no
   * hay identidad que pisar. Un reenvío con la misma clave devuelve la captura anterior sin
   * modificarla y sin volver a correr la automatización, que ya corrió la primera vez.
   *
   * @param repo - Repositorio de la transacción, o el del servicio si no hay ninguna.
   * @param manager - Se propaga a la automatización para que escriba en la misma transacción.
   * @param mode - Ver {@link LeadCaptureMode}.
   */
  private async persistCapture(
    normalized: LeadCaptureInput & { retentionReviewAt?: Date },
    domain: LeadDomain,
    repo: Repository<Lead>,
    manager?: EntityManager,
    mode: LeadCaptureMode = 'upsert',
  ): Promise<{ lead: Lead; contact: Contact | null }> {
    if (mode === 'create-only') {
      const replay = await this.findReplay(normalized, repo);
      if (replay) return { lead: replay, contact: null };
    }

    const match: LeadMatch = mode === 'create-only'
      ? { lead: null }
      : await this.findExistingLead(normalized, repo, domain);
    const qualification = this.qualifyLead(normalized, domain);
    const retentionReviewAt = this.buildRetentionReviewDate();

    const lead = match.lead ?? repo.create({ organizationId: normalized.organizationId });
    const identityChange = match.lead ? this.identityDiff(match.lead, normalized) : null;

    Object.assign(lead, {
      ...normalized,
      // El dominio se fija al crear el lead y no cambia en updates posteriores: una captura de
      // otro origen no debe poder mover un lead entre embudos silenciosamente.
      domain: match.lead?.domain ?? domain,
      // La fecha de origen es la de la primera captura y no se pisa: si el mismo lead vuelve a
      // llegar por otro canal, lo que interesa sigue siendo cuándo apareció, no cuándo se
      // repitió. Sin esta regla, una reimportación desplazaría todo el historial al presente.
      sourceCreatedAt: match.lead?.sourceCreatedAt ?? normalized.sourceCreatedAt ?? null,
      qualityScore: qualification.qualityScore,
      fitStatus: qualification.fitStatus,
      trafficLight: normalized.trafficLight ?? match.lead?.trafficLight ?? null,
      discardReason: qualification.discardReason,
      retentionReviewAt: normalized.retentionReviewAt ?? retentionReviewAt,
      metadata: {
        ...(match.lead?.metadata ?? {}),
        ...(normalized.metadata ?? {}),
        scoringSignals: qualification.scoringSignals,
        ...(match.conflict ? { identityConflict: { ...match.conflict, detectedAt: new Date().toISOString() } } : {}),
      },
    });

    if (!lead.status) lead.status = 'new';
    // Un lead recién capturado lleva parado desde ahora: sin esto la alerta lo daría por
    // inactivo desde una fecha vacía, o no lo miraría nunca.
    lead.stageChangedAt ??= new Date();
    const savedLead = await repo.save(lead);
    if (identityChange) await this.recordIdentityChange(savedLead, identityChange);
    const contact = await this.runAutomation(savedLead, domain, manager);
    return { lead: await repo.save(savedLead), contact };
  }

  /**
   * Captura anterior con el mismo `externalLeadId`, si la hay.
   *
   * Es la guardia contra reenvíos del modo `create-only`: identifica al envío, no a la
   * persona. Solo se compara la clave —nunca correo ni teléfono—, de modo que conocerla no
   * alcanza para llegar a un lead que se creó por otra vía.
   */
  private async findReplay(input: LeadCaptureInput, repo: Repository<Lead>): Promise<Lead | null> {
    if (!input.externalLeadId) return null;
    return repo.findOne({ where: { organizationId: input.organizationId, externalLeadId: input.externalLeadId } });
  }

  /** Campos de identidad que cambian de valor, o `null` si ninguno cambia. */
  private identityDiff(existing: Lead, incoming: LeadCaptureInput): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
    const fields = ['name', 'email', 'phone', 'company'] as const;
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    for (const field of fields) {
      const next = incoming[field];
      if (next === undefined || next === existing[field]) continue;
      before[field] = existing[field];
      after[field] = next;
    }
    return Object.keys(after).length > 0 ? { before, after } : null;
  }

  /**
   * Deja constancia de que una captura sin usuario cambió los datos de una persona.
   *
   * `actorId` va vacío a propósito: no hay usuario detrás, y atribuirlo a alguien sería peor
   * que dejarlo en blanco. El motivo dice de dónde vino.
   */
  private async recordIdentityChange(lead: Lead, change: { before: Record<string, unknown>; after: Record<string, unknown> }): Promise<void> {
    try {
      await this.audit.log({
        organizationId: lead.organizationId,
        actorId: undefined,
        entityType: 'crm_leads',
        entityId: lead.id,
        action: 'identity_overwritten',
        before: change.before,
        after: change.after,
        reason: `capture:${lead.source ?? 'desconocido'}`,
      });
    } catch (error) {
      this.logger.warn(`No se pudo auditar la sobrescritura del lead ${lead.id}: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Separa el dominio del resto del payload.
   *
   * `domain` decide qué automatización corre y además se persiste en `leads.domain`
   * (migración 0069) — se separa acá solo para no depender del orden de propiedades del
   * spread al armar el `Object.assign` de la entidad más abajo.
   */
  private splitDomain(input: LeadCaptureInput): { domain: LeadDomain; payload: LeadCaptureInput } {
    const { domain = 'commercial', ...payload } = input;
    return { domain, payload };
  }

  /**
   * Ejecuta la automatización que corresponde al dominio de la captura.
   *
   * Una reserva no es una venta: para `audience` solo se asegura el contacto, sin abrir
   * oportunidad ni asignar responsable comercial.
   */
  private async runAutomation(lead: Lead, domain: LeadDomain, manager?: EntityManager): Promise<Contact | null> {
    if (domain === 'audience') {
      return this.automation.ensureAudienceContact(lead, manager);
    }
    await this.automation.runForLead(lead, manager);
    return null;
  }

  private normalizeInput(input: LeadCaptureInput): LeadCaptureInput & { retentionReviewAt?: Date } {
    return {
      ...input,
      name: input.name.trim().replace(/\s+/g, ' '),
      email: input.email?.trim().toLowerCase() || undefined,
      phone: normalizePhone(input.phone),
      company: input.company?.trim().replace(/\s+/g, ' ') || undefined,
      source: input.source?.trim().toLowerCase().replace(/\s+/g, '_') || undefined,
      sourceDetail: input.sourceDetail?.trim().replace(/\s+/g, ' ') || undefined,
      campaignName: input.campaignName?.trim().replace(/\s+/g, ' ') || undefined,
      notes: input.notes?.trim() || undefined,
    };
  }

  /**
   * Refleja en el lead el estado de una reserva.
   *
   * Si el lead encontrado no es de audiencia, no se toca. El cruce es por correo o teléfono, y
   * la misma persona puede ser a la vez comensal de un local y contacto de una empresa
   * prospecto: escribirle `attended` a su lead comercial le borraría la etapa de venta en la
   * que estaba. Devolver `null` es correcto acá —no hay a quién reflejarlo— y el llamador ya
   * trata ese caso.
   */
  async updateStatusByContact(organizationId: string, status: string, email?: string | null, phone?: string | null, clientId?: string): Promise<Lead | null> {
    if (!email && !phone) return null;
    const conditions: FindOptionsWhere<Lead>[] = [];
    const base: FindOptionsWhere<Lead> = { organizationId };
    if (clientId) base.clientId = clientId;
    if (email) conditions.push({ ...base, email });
    if (phone) conditions.push({ ...base, phone });
    const lead = await this.repo.findOne({ where: conditions });
    if (!lead) return null;
    if (!isStatusInDomain(lead.domain, status as LeadStatus)) {
      this.logger.warn(`No se refleja el estado "${status}" en el lead ${lead.id}: es de dominio ${lead.domain}`);
      return null;
    }
    lead.status = status;
    lead.stageChangedAt = new Date();
    return this.repo.save(lead);
  }

  /**
   * Busca una captura previa de la misma persona.
   *
   * El orden de las señales depende del dominio. Para audiencia el teléfono manda: es obligatorio
   * en la reserva, casi siempre único por persona, y el correo suele ser opcional o compartido
   * —una familia que reserva con la casilla de uno solo generaría contactos falsamente distintos
   * si el correo decidiera primero. Para el dominio comercial el correo sigue mandando, porque
   * identifica a la persona dentro de la empresa.
   *
   * La búsqueda queda acotada al cliente cuando hay uno: el mismo teléfono en dos restaurantes
   * son dos personas distintas a efectos de datos, y deben quedar separadas.
   */
  /**
   * Busca un lead existente por teléfono/email, sin fusionar automáticamente ante ambigüedad.
   *
   * Si teléfono y correo apuntan a leads DISTINTOS, no hay forma segura de saber cuál es el
   * correcto — fusionar el que llegue primero sobrescribiría datos de una persona con los de
   * otra. En ese caso se trata como "sin coincidencia segura" (se crea un lead nuevo) y se deja
   * la ambigüedad registrada en `metadata.identityConflict` para revisión manual, en vez de
   * adivinar.
   */
  private async findExistingLead(
    input: LeadCaptureInput,
    repo: Repository<Lead> = this.repo,
    domain: LeadDomain = 'commercial',
  ): Promise<LeadMatch> {
    if (input.externalLeadId) {
      const byExternalId = await repo.findOne({
        where: { organizationId: input.organizationId, externalLeadId: input.externalLeadId },
      });
      if (byExternalId) return { lead: byExternalId, matchedBy: 'externalLeadId' };
    }

    const baseWhere: FindOptionsWhere<Lead> = { organizationId: input.organizationId };
    if (input.clientId) baseWhere.clientId = input.clientId;

    const [byPhone, byEmail] = await Promise.all([
      input.phone ? repo.findOne({ where: { ...baseWhere, phone: input.phone } }) : Promise.resolve(null),
      input.email ? repo.findOne({ where: { ...baseWhere, email: input.email } }) : Promise.resolve(null),
    ]);

    if (byPhone && byEmail && byPhone.id !== byEmail.id) {
      return {
        lead: null,
        conflict: { otherLeadId: (domain === 'audience' ? byEmail : byPhone).id, otherMatchedBy: domain === 'audience' ? 'email' : 'phone' },
      };
    }

    if (domain === 'audience') {
      if (byPhone) return { lead: byPhone, matchedBy: 'phone' };
      if (byEmail) return { lead: byEmail, matchedBy: 'email' };
    } else {
      if (byEmail) return { lead: byEmail, matchedBy: 'email' };
      if (byPhone) return { lead: byPhone, matchedBy: 'phone' };
    }

    return { lead: null };
  }

  private qualifyLead(input: LeadCaptureInput, domain: LeadDomain = 'commercial'): LeadQualificationResult {
    // El scoring mide encaje comercial: correo corporativo, empresa, intención de compra. Aplicado
    // a un comensal no significa nada —reservar una mesa con Gmail no es una señal de baja calidad—
    // así que la audiencia no se puntúa y queda siempre en revisión, fuera de toda priorización.
    if (domain === 'audience') {
      return { qualityScore: 0, fitStatus: LeadFitStatus.REVIEW, scoringSignals: ['audience'] };
    }

    // Un prospecto anotado a mano no se descarta solo. El puntaje mide señales que solo existen
    // cuando el lead llega por su cuenta —correo corporativo, campaña de origen, palabras de
    // intención—, y quien lo escribe desde el tablero no aporta ninguna: escribe un nombre y, con
    // suerte, un teléfono. Puntuarlo con esa vara lo dejaba bajo el umbral y nacía «Descartado»,
    // que además lo saca de la automatización comercial. Sigue pudiendo calificar por puntaje;
    // lo que no puede es descartarse sin que nadie lo haya decidido.
    const anotadoAMano = input.enteredByPerson === true;

    let qualityScore = 0;
    const signals: string[] = [];
    const haystack = [
      input.sourceDetail,
      input.campaignName,
      input.company,
      input.notes,
      JSON.stringify(input.metadata ?? {}),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (input.email) {
      qualityScore += 20;
      signals.push('email');
    }

    if (input.phone) {
      qualityScore += 25;
      signals.push('phone');
    }

    if (input.company) {
      qualityScore += 15;
      signals.push('company');
    }

    if (input.email && !this.isGenericEmail(input.email)) {
      qualityScore += 10;
      signals.push('work_email');
    }

    if (input.source === 'meta_lead_ads') {
      qualityScore += 10;
      signals.push('meta_source');
    }

    if (input.externalCampaignId || input.campaignName) {
      qualityScore += 5;
      signals.push('campaign_context');
    }

    const highIntentHits = HIGH_INTENT_KEYWORDS.filter((keyword) => haystack.includes(keyword));
    qualityScore += highIntentHits.length * 6;
    if (highIntentHits.length > 0) signals.push(`high_intent:${highIntentHits.slice(0, 3).join(',')}`);

    const lowQualityHits = LOW_QUALITY_KEYWORDS.filter((keyword) => haystack.includes(keyword));
    if (lowQualityHits.length > 0) {
      return {
        qualityScore: Math.max(qualityScore - 30, 0),
        fitStatus: anotadoAMano ? LeadFitStatus.REVIEW : LeadFitStatus.UNQUALIFIED,
        // Un motivo de descarte en un lead que no está descartado se lee como si lo estuviera.
        discardReason: anotadoAMano ? undefined : `Se detectaron señales de bajo encaje: ${lowQualityHits.slice(0, 3).join(', ')}`,
        scoringSignals: [...signals, `low_quality:${lowQualityHits.slice(0, 3).join(',')}`],
      };
    }

    if (!input.email && !input.phone) {
      return {
        qualityScore,
        fitStatus: anotadoAMano ? LeadFitStatus.REVIEW : LeadFitStatus.UNQUALIFIED,
        discardReason: anotadoAMano ? undefined : 'No dejó email ni teléfono para contacto comercial.',
        scoringSignals: [...signals, 'missing_contact_channel'],
      };
    }

    if (qualityScore >= 70) {
      return { qualityScore, fitStatus: LeadFitStatus.QUALIFIED, scoringSignals: signals };
    }

    if (qualityScore >= 35) {
      return { qualityScore, fitStatus: LeadFitStatus.REVIEW, scoringSignals: signals };
    }

    /*
     * Puntaje bajo deja el lead **en revisión**, no descartado.
     *
     * Antes un lead que llegaba por integración con menos de 35 puntos nacía `unqualified` y
     * además con motivo de descarte, lo que le creaba una interacción «descartado» y lo dejaba
     * marcado como si alguien lo hubiera revisado y rechazado. Nadie lo había mirado.
     *
     * El puntaje mide señales de encaje, no la voluntad de trabajar a alguien: quien deja su
     * teléfono en una campaña de barrio puntúa bajo y puede ser la venta del mes. Descartar por
     * esa vara saca del embudo a gente que nunca se evaluó, y el equipo ni siquiera la ve.
     *
     * Descartar sigue siendo una decisión de una persona. El puntaje se conserva y ordena; lo
     * que ya no hace es cerrar la puerta solo.
     */
    return {
      qualityScore,
      fitStatus: LeadFitStatus.REVIEW,
      scoringSignals: [...signals, 'low_score'],
    };
  }

  private isGenericEmail(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    return Boolean(domain && GENERIC_EMAIL_DOMAINS.has(domain));
  }

  /**
   * Cuándo hay que volver a mirar si estos datos personales siguen haciendo falta.
   *
   * **Siempre devuelve una fecha.** Antes salía de una variable de entorno y, si esa variable
   * no estaba puesta, devolvía nada: el lead nacía sin fecha de revisión y la purga no lo
   * miraba nunca. La retención quedaba apagada por omisión, que es la forma más silenciosa de
   * conservar datos personales para siempre.
   *
   * El valor por omisión son veinticuatro meses. Es un plazo, no una decisión definitiva:
   * `CRM_LEAD_RETENTION_DAYS` lo cambia, pero ya no puede dejarlo sin plazo.
   *
   * Que llegue la fecha no borra nada por sí solo. Marca el momento de revisar, y la purga
   * decide después: una venta conserva su fundamento y no se toca.
   */
  private buildRetentionReviewDate(): Date {
    const configurado = Number(process.env.CRM_LEAD_RETENTION_DAYS ?? '');
    const dias = Number.isFinite(configurado) && configurado > 0
      ? configurado
      : LeadIntakeService.DIAS_DE_RETENCION_POR_OMISION;
    return new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  }
}
