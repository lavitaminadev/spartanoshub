import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, MoreThan, Repository, SelectQueryBuilder } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { promises as dns } from 'dns';
import { ReservationForm } from '../domain/reservation-form.entity';
import { Reservation } from '../domain/reservation.entity';
import { AvailabilityBlock } from '../domain/availability-block.entity';
import { ReservationEvent } from '../domain/reservation-event.entity';
import { ReservationFormEvent } from '../domain/reservation-form-event.entity';
import { ReservationCoupon } from '../domain/reservation-coupon.entity';
import { SurveyContactRequest } from '../domain/survey-contact-request.entity';
import { ReservationManagementToken } from '../domain/reservation-management-token.entity';
import { ReservationHold } from '../domain/reservation-hold.entity';
import { ReservationGroupRequest } from '../domain/reservation-group-request.entity';
import { addPlainDays, assertTimeZone, plainDateParts, startOfLocalDayUtc, tryLocalToUtc, zonedParts } from '../domain/timezone';
import { normalizePhone } from '../../../shared/phone';
import { randomUUID } from 'node:crypto';
import { retryOnDeadlock } from '../../../shared/retry-on-deadlock';
import { CloseReservationDayDto, CreateBlockDto, CreateCouponDto, CreateManualReservationDto, CreateReservationFormDto, ListReservationsDto, PublicFormEventDto, PublicGroupRequestDto, PublicReservationDto, PublicReservationHoldDto, PublicSurveyResponseDto, UpdateCouponDto, UpdateReservationDto, UpdateReservationFormDto } from '../dto/reservation.dto';
import { META_DEDUPLICATED_EVENTS, META_SERVER_ONLY_EVENTS, metaEventId, type MetaEvent } from '@espartanos/shared';
import { GoogleCalendarService } from '../../integrations/google/google-calendar.service';
import { MetaConversionOutboxService } from '../../integrations/meta/meta-conversion-outbox.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { EmailService } from '../../../core/notifications/email.service';
import { componerCorreo } from '../../../core/notifications/plantilla-de-correo';
import { ORGANIZATION_SETTINGS } from '../../../core/parameters/organization-settings.catalog';
import { ParameterResolver } from '../../../core/parameters/parameter-resolver.service';
import { AuditService } from '../../../core/audit/audit.service';
import { MetaClientPixelService } from '../../integrations/meta/meta-client-pixel.service';
import { inferLocationFromPhone } from '../../../shared/geo-inference';
import { GoogleConversionOutboxService } from '../../integrations/google/google-conversion-outbox.service';
import { normalizeClientCapabilities } from '../../clients/client-capabilities';

/**
 * Recomendaciones que el local muestra al confirmar una reserva.
 *
 * Es el valor inicial; después se edita desde el constructor, en el paso de diseño. Las cuatro
 * responden preguntas que la persona se hace igual y que, sin respuesta, terminan en una
 * llamada al local o en una inasistencia: a qué hora conviene llegar, dónde dejar el auto, cómo
 * avisar si no puede venir, y a quién escribir si duda.
 *
 * La tercera es la que más pesa: ofrecer la salida reduce la inasistencia, porque quien sabe que
 * puede cancelar avisa en vez de no aparecer.
 *
 * El catálogo completo de sugerencias, con el motivo de cada una, vive en el frontend:
 * `features/reservations/success/venue-tips.ts`, que es donde se eligen.
 */
const DEFAULT_VENUE_TIPS = [
  'Te esperamos 10 minutos antes para acomodarte con calma.',
  'Estamos en la esquina; si llegas en auto, hay estacionamiento a media cuadra.',
  'Si te surge algo, avísanos con tu código y liberamos la mesa sin problema.',
  '¿Alguna duda antes de venir? Escríbenos y te respondemos.',
].join('\n');

type ScheduleWindow = { day: number; start: string; end: string };
type ServiceConfig = { id: string; name: string; durationMinutes?: number; capacity?: number; active?: boolean };
type ResourceConfig = { id: string; name: string; capacity?: number; windows?: ScheduleWindow[]; active?: boolean };
type FieldConfig = { id: string; type: string; label: string; required?: boolean; internal?: boolean; options?: string[] };
type GuestSubmission = { guestName: string; guestEmail?: string; guestPhone?: string };
type DesignConfig = {
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  title?: string;
  welcome?: string;
  confirmationMessage?: string;
  logoUrl?: string;
  backgroundImage?: string;
  backgroundMode?: string;
  backgroundGradient?: string;
  backgroundOpacity?: string;
  backgroundPosition?: string;
  backgroundSize?: string;
  layoutPosition?: string;
  logoPosition?: string;
  buttonRadius?: string;
  fieldRadius?: string;
  fontFamily?: string;
  legalCompanyName?: string; legalCompanyId?: string; supportEmail?: string; privacyUrl?: string; termsUrl?: string;
  cancellationPolicy?: string; reservationConsentText?: string; marketingConsentText?: string; marketingConsentVersion?: string;
  campaignAlias?: string; welcomePopupEnabled?: string; welcomePopupTitle?: string; welcomePopupText?: string;
  askChildren?: string; askAccessibility?: string; askAllergies?: string;
  whatsappBusinessNumber?: string; whatsappGroupMessage?: string;
  groupThreshold?: string; holdMinutes?: string; slotCadenceMinutes?: string; lastReservableMinutesBeforeClose?: string;
  autoCloseAttendance?: string; autoCloseAfterMinutes?: string;
  /** Instante UTC hasta el cual la página pública no ofrece nuevos horarios. */
  bookingPausedUntil?: string;
  /** Por defecto se conserva el límite global histórico de la empresa. */
  enforceCompanyDailyCap?: string;
};

const FIELD_TYPES = new Set(['text', 'textarea', 'email', 'phone', 'select', 'multi_select', 'number', 'date', 'consent', 'coupon', 'rating', 'nps']);
/** Tipos cuyas respuestas son una alternativa de una lista cerrada. */
/** Estados que puede tomar una solicitud de contacto post-encuesta. */
// Solo las reservas que aún tienen un turno futuro consumen capacidad.
const ACTIVE_STATUSES = ['pending', 'confirmed', 'rescheduled'];
/**
 * Techo del horizonte que la disponibilidad publica puede recorrer de una vez. Acota el
 * tamano de la respuesta y las filas leidas; el limite real de cada formulario sale de su
 * `maximumAdvanceDays` cuando este es menor.
 */
const MAX_SLOT_RANGE_DAYS = 62;

/** Enunciado de las respuestas que el servidor agrega fuera del esquema del formulario. */
const RESPUESTAS_DEL_SISTEMA: Record<string, string> = {
  groupEventType: 'Tipo de celebración',
  groupEventNotes: 'Notas del grupo',
  childrenCount: 'Niños',
  accessibilityNeed: 'Accesibilidad',
  dietaryNotes: 'Restricciones alimentarias',
};
/**
 * Dias que el enlace de gestion sigue sirviendo despues de la reserva.
 *
 * El enlace permite cancelar y reagendar, asi que su vida se ata a la reserva y no a una
 * ventana fija desde que se emitio: cubre el margen razonable tras la visita sin dejar
 * abierta la puerta durante meses.
 */
const GESTION_TRAS_LA_VISITA_DIAS = 60;
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled_client', 'cancelled_business', 'waitlist'],
  confirmed: ['rescheduled', 'cancelled_client', 'cancelled_business', 'attended', 'no_show'],
  rescheduled: ['confirmed', 'cancelled_client', 'cancelled_business', 'attended', 'no_show'],
  waitlist: ['confirmed', 'cancelled_client', 'cancelled_business'],
  attended: [], no_show: [], cancelled_client: [], cancelled_business: [],
};

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(ReservationForm) private readonly forms: Repository<ReservationForm>,
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    @InjectRepository(AvailabilityBlock) private readonly blocks: Repository<AvailabilityBlock>,
    @InjectRepository(ReservationEvent) private readonly events: Repository<ReservationEvent>,
    @InjectRepository(ReservationFormEvent) private readonly formEvents: Repository<ReservationFormEvent>,
    @InjectRepository(ReservationCoupon) private readonly coupons: Repository<ReservationCoupon>,
    private readonly dataSource: DataSource,
    private readonly calendar: GoogleCalendarService,
    private readonly metaOutbox: MetaConversionOutboxService,
    private readonly clientPixels: MetaClientPixelService,
    private readonly notifications: NotificationService,
    private readonly emails: EmailService,
    private readonly audit: AuditService,
    // Se agrega al final a propósito: las pruebas instancian el servicio con
    // argumentos posicionales, así que insertarlo en medio desplazaría las
    // dependencias existentes.
    private readonly googleOutbox: GoogleConversionOutboxService,
    @InjectRepository(SurveyContactRequest) private readonly surveyContacts: Repository<SurveyContactRequest>,
    @InjectRepository(ReservationGroupRequest) private readonly groupRequests: Repository<ReservationGroupRequest>,
    // Al final, por el mismo motivo que el anterior: las pruebas pasan los argumentos por
    // posición y meterlo en medio desplazaría todo lo que viene detrás.
    private readonly parametros: ParameterResolver,
    @InjectRepository(ReservationManagementToken) private readonly managementTokens: Repository<ReservationManagementToken>,
    @InjectRepository(ReservationHold) private readonly holds: Repository<ReservationHold>,
  ) {}
  private readonly logger = new Logger(ReservationsService.name);

  private slug(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 140); }
  private scope(organizationId: string, clientId?: string, clientIds?: string[]) { return { organizationId, ...(clientId ? { clientId } : clientIds !== undefined ? { clientId: In(clientIds) } : {}) }; }
  private sqlClientScope(clientId?: string, clientIds?: string[]) {
    if (clientId) return { clause: ' AND client_id = ?', params: [clientId] };
    if (clientIds === undefined) return { clause: '', params: [] as string[] };
    if (clientIds.length === 0) return { clause: ' AND 1 = 0', params: [] as string[] };
    return { clause: ` AND client_id IN (${clientIds.map(() => '?').join(',')})`, params: clientIds };
  }
  private minutes(value: string) { const match = /^(\d{2}):(\d{2})$/.exec(value); if (!match) return -1; const total = Number(match[1]) * 60 + Number(match[2]); return Number(match[1]) < 24 && Number(match[2]) < 60 ? total : -1; }
  private overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) { return aStart < bEnd && aEnd > bStart; }
  private minutesOverlaps(aStartMin: number, aEndMin: number, bStartMin: number, bEndMin: number) { return aStartMin < bEndMin && aEndMin > bStartMin; }
  private configs(form: ReservationForm) { return { services: (form.servicesConfig || []) as ServiceConfig[], resources: (form.resourcesConfig || []) as ResourceConfig[] }; }

  private validateConfiguration(form: Pick<ReservationForm, 'timezone'|'fieldSchema'|'designConfig'|'scheduleConfig'|'servicesConfig'|'resourcesConfig'|'durationMinutes'|'bufferMinutes'|'capacityPerSlot'>) {
    assertTimeZone(form.timezone);
    const fields = form.fieldSchema as FieldConfig[];
    if (!Array.isArray(fields) || fields.length === 0 || fields.length > 80) throw new BadRequestException('El formulario debe contener entre 1 y 80 campos');
    const fieldIds = new Set<string>();
    for (const field of fields) {
      if (!field || typeof field.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(field.id) || fieldIds.has(field.id)) throw new BadRequestException('Los campos deben tener identificadores únicos y válidos');
      if (!FIELD_TYPES.has(field.type) || typeof field.label !== 'string' || !field.label.trim() || field.label.length > 180) throw new BadRequestException(`Configuración inválida en el campo ${field.id}`);
      if (['select', 'multi_select'].includes(field.type) && (!Array.isArray(field.options) || field.options.length < 1 || field.options.length > 100)) throw new BadRequestException(`El campo ${field.id} requiere opciones válidas`);
      if (field.options && (new Set(field.options).size !== field.options.length || field.options.some((option) => typeof option !== 'string' || !option.trim() || option.length > 180))) throw new BadRequestException(`El campo ${field.id} contiene opciones inválidas o duplicadas`);
      fieldIds.add(field.id);
    }
    if (!fields.some((field) => field.id === 'name' && field.required)) throw new BadRequestException('El nombre debe permanecer como campo obligatorio');
    if (!fields.some((field) => field.type === 'consent' && field.required)) throw new BadRequestException('El formulario requiere una aceptación de tratamiento de datos');
    const validateWindows = (windows: unknown, label: string) => {
      if (!Array.isArray(windows) || windows.length > 40) throw new BadRequestException(`${label} no es válida`);
      for (const window of windows as ScheduleWindow[]) if (!Number.isInteger(window.day) || window.day < 0 || window.day > 6 || this.minutes(window.start) < 0 || this.minutes(window.end) <= this.minutes(window.start)) throw new BadRequestException(`Existe una ventana horaria inválida en ${label}`);
      for (let day = 0; day <= 6; day++) {
        const dayWindows = (windows as ScheduleWindow[]).filter((window) => window.day === day).sort((a, b) => this.minutes(a.start) - this.minutes(b.start));
        for (let previous = dayWindows[0], i = 1; i < dayWindows.length; i++) { const current = dayWindows[i]; if (this.minutesOverlaps(this.minutes(previous.start), this.minutes(previous.end), this.minutes(current.start), this.minutes(current.end))) throw new BadRequestException(`Ventanas de ${label} se superponen`); previous = current; }
      }
    };
    const validateWindowsIfPresent = (windows: unknown, label: string) => { if (windows !== undefined && windows !== null) validateWindows(windows, label); };
    const windows = (form.scheduleConfig as { windows?: ScheduleWindow[] })?.windows;
    validateWindowsIfPresent(windows, 'La agenda semanal');
    for (const collection of [form.servicesConfig || [], form.resourcesConfig || []] as Array<Array<{ id?: unknown; name?: unknown; durationMinutes?: unknown; capacity?: unknown; windows?: unknown; active?: unknown }>>) {
      const ids = new Set<string>();
      for (const item of collection) {
        if (typeof item?.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 180) throw new BadRequestException('Servicios y recursos requieren ID y nombre únicos');
        if (item.durationMinutes !== undefined && (!Number.isInteger(item.durationMinutes) || Number(item.durationMinutes) < 5 || Number(item.durationMinutes) > 1440)) throw new BadRequestException('La duración del servicio no es válida');
        if (item.capacity !== undefined && (!Number.isInteger(item.capacity) || Number(item.capacity) < 1 || Number(item.capacity) > 500)) throw new BadRequestException('La capacidad del servicio o recurso no es válida');
        if (item.active !== undefined && typeof item.active !== 'boolean') throw new BadRequestException('El estado del servicio o recurso no es válido');
        if (item.windows !== undefined && item.windows !== null) validateWindowsIfPresent(item.windows, `La agenda de ${item.name}`);
        ids.add(item.id);
      }
    }
    const design = form.designConfig as DesignConfig;
    for (const color of [design.primaryColor, design.accentColor, design.backgroundColor, design.textColor].filter(Boolean)) if (!/^#[0-9a-fA-F]{6}$/.test(color!)) throw new BadRequestException('Los colores deben usar formato hexadecimal');
    if (design.title && design.title.length > 180 || design.welcome && design.welcome.length > 1200 || design.confirmationMessage && design.confirmationMessage.length > 1200) throw new BadRequestException('Los textos de diseño exceden el largo permitido');
    if (design.backgroundMode && !['color', 'gradient', 'image'].includes(design.backgroundMode)) throw new BadRequestException('El tipo de fondo no es válido');
    if (design.bookingPausedUntil !== undefined && design.bookingPausedUntil !== '') {
      const pausedUntil = new Date(design.bookingPausedUntil);
      if (typeof design.bookingPausedUntil !== 'string' || Number.isNaN(pausedUntil.getTime()) || !/^\d{4}-\d{2}-\d{2}T/.test(design.bookingPausedUntil)) throw new BadRequestException('La pausa de reservas no tiene una fecha válida');
    }
    if (design.enforceCompanyDailyCap !== undefined && !['true', 'false'].includes(design.enforceCompanyDailyCap)) throw new BadRequestException('La regla de cupo global no es válida');
    for (const [label, value, min, max] of [
      ['El umbral de grupo', design.groupThreshold, 2, 100], ['La retención de cupo', design.holdMinutes, 1, 30],
      ['El ritmo por franja', design.slotCadenceMinutes, 5, 240], ['La última llegada antes del cierre', design.lastReservableMinutesBeforeClose, 0, 360], ['El margen de cierre automático', design.autoCloseAfterMinutes, 15, 1440],
    ] as Array<[string, unknown, number, number]>) {
      if (value !== undefined && (!/^\d+$/.test(String(value)) || Number(value) < min || Number(value) > max)) throw new BadRequestException(`${label} no es válido`);
    }
    if (design.backgroundGradient && (design.backgroundGradient.length > 500 || !/^linear-gradient\(/i.test(design.backgroundGradient.trim()))) throw new BadRequestException('El degradado de fondo no es válido');
    if (design.backgroundOpacity !== undefined && (!Number.isFinite(Number(design.backgroundOpacity)) || Number(design.backgroundOpacity) < 0 || Number(design.backgroundOpacity) > 100)) throw new BadRequestException('La opacidad de fondo no es válida');
    if (design.backgroundPosition && !['center', 'top', 'bottom', 'left', 'right'].includes(design.backgroundPosition)) throw new BadRequestException('La posición del fondo no es válida');
    if (design.buttonRadius !== undefined && (!Number.isFinite(Number(design.buttonRadius)) || Number(design.buttonRadius) < 0 || Number(design.buttonRadius) > 999)) throw new BadRequestException('La forma de botones no es válida');
    if (design.fieldRadius !== undefined && (!Number.isFinite(Number(design.fieldRadius)) || Number(design.fieldRadius) < 0 || Number(design.fieldRadius) > 80)) throw new BadRequestException('La forma de campos no es válida');
    if (design.fontFamily && (design.fontFamily.length > 120 || /[;{}]/.test(design.fontFamily))) throw new BadRequestException('La tipografía no es válida');
    for (const [label, value, limit] of [
      ['La razón social', design.legalCompanyName, 180], ['El RUT', design.legalCompanyId, 80], ['El correo de soporte', design.supportEmail, 190],
      ['La política de cancelación', design.cancellationPolicy, 1200], ['El texto de reserva', design.reservationConsentText, 1200],
      ['El texto de marketing', design.marketingConsentText, 800], ['La versión de marketing', design.marketingConsentVersion, 30],
      ['El alias de campaña', design.campaignAlias, 80], ['El título de bienvenida', design.welcomePopupTitle, 180], ['El texto de bienvenida', design.welcomePopupText, 1200],
      ['El mensaje de WhatsApp', design.whatsappGroupMessage, 1200],
    ] as Array<[string, unknown, number]>) if (value !== undefined && (typeof value !== 'string' || value.length > limit)) throw new BadRequestException(`${label} no es válido`);
    if (design.welcomePopupEnabled !== undefined && design.welcomePopupEnabled !== 'true' && design.welcomePopupEnabled !== 'false') throw new BadRequestException('La bienvenida no es válida');
    if (design.whatsappBusinessNumber && (typeof design.whatsappBusinessNumber !== 'string' || !/^\+?[1-9]\d{7,14}$/.test(design.whatsappBusinessNumber.replace(/[\s()-]/g, '')))) throw new BadRequestException('El WhatsApp del local debe usar formato internacional');
    const isValidImageUrl = (url?: string) => !url || (/^https:\/\//i.test(url) && url.length <= 2048);
    if (!isValidImageUrl(design.logoUrl)) throw new BadRequestException('El logo debe usar una URL HTTPS válida');
    if (!isValidImageUrl(design.backgroundImage)) throw new BadRequestException('La imagen de fondo debe usar una URL HTTPS válida');
    for (const url of [design.privacyUrl, design.termsUrl]) if (url && (typeof url !== 'string' || !/^https:\/\//i.test(url) || url.length > 2048)) throw new BadRequestException('Los enlaces legales deben usar una URL HTTPS válida');
  }

  private validateAnswers(form: ReservationForm, answers: Record<string, unknown>): void {
    const fields = (form.fieldSchema as FieldConfig[]).filter((f) => f.type !== 'coupon'); const byId = new Map(fields.map((field) => [field.id, field]));
    const keys = Object.keys(answers); if (keys.length > fields.length || keys.some((key) => !byId.has(key))) throw new BadRequestException('Las respuestas contienen campos no publicados');
    for (const [key, value] of Object.entries(answers)) {
      const field = byId.get(key)!;
      if (typeof value === 'string' && value.length > 5000) throw new BadRequestException(`La respuesta de ${field.label} es demasiado extensa`);
      if (Array.isArray(value) && (value.length > 100 || value.some((entry) => typeof entry !== 'string' || entry.length > 500))) throw new BadRequestException(`La respuesta de ${field.label} no es válida`);
      if (field.type === 'number' && (typeof value !== 'number' && typeof value !== 'string' || !Number.isFinite(Number(value)))) throw new BadRequestException(`La respuesta de ${field.label} debe ser numérica`);
      if (field.type === 'rating' && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 5)) throw new BadRequestException(`La respuesta de ${field.label} debe estar entre 1 y 5`);
      if (field.type === 'consent' && typeof value !== 'boolean') throw new BadRequestException(`La respuesta de ${field.label} debe ser una aceptación`);
    }
  }

  private validateSubmission(form: ReservationForm, answers: Record<string, unknown>, guest: GuestSubmission): void {
    this.validateAnswers(form, answers);
    for (const field of form.fieldSchema as FieldConfig[]) {
      const value = field.id === 'name' ? guest.guestName : field.id === 'email' ? guest.guestEmail : field.id === 'phone' ? guest.guestPhone : answers[field.id];
      const empty = value == null || value === '' || value === false || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0);
      if (field.required && empty) throw new BadRequestException(`Falta completar ${field.label}`);
      if (empty) continue;
      if (field.type === 'select' && field.options && !field.options.includes(String(value))) throw new BadRequestException(`Respuesta inválida en ${field.label}`);
      if (field.type === 'multi_select' && field.options && (!Array.isArray(value) || value.some((entry) => !field.options!.includes(String(entry))))) throw new BadRequestException(`Respuesta inválida en ${field.label}`);
      if (field.type === 'email' && typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new BadRequestException(`Correo inválido en ${field.label}`);
    }
  }

  private async assertClientOwnership(organizationId: string, clientId: string) {
    const rows = await this.dataSource.query('SELECT id FROM clients WHERE id = ? AND organization_id = ? LIMIT 1', [clientId, organizationId]);
    if (!Array.isArray(rows) || rows.length === 0) throw new ForbiddenException('El cliente no pertenece a esta organización');
  }

  /**
   * Transacción que se reintenta si MySQL la aborta por interbloqueo.
   *
   * Crear una reserva no puede enclavarse —siempre bloquea primero la fila del formulario y
   * después el rango de horarios—, pero reagendar lo hace al revés, así que dos
   * reagendamientos que se crucen sí forman un ciclo. Sin reintento eso es un 500 para el
   * operador, cuando basta con volver a intentarlo.
   */
  private transaction<T>(operation: string, work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return retryOnDeadlock(operation, () => this.dataSource.transaction(work));
  }

  private async clientCapabilities(organizationId: string, clientId: string, queryFn?: (sql: string, params?: unknown[]) => Promise<unknown[]>) {
    const q = queryFn || this.dataSource.query.bind(this.dataSource);
    const rows = await q('SELECT capabilities, status FROM clients WHERE id = ? AND organization_id = ? LIMIT 1', [clientId, organizationId]);
    if (!Array.isArray(rows) || rows.length === 0) throw new ForbiddenException('El cliente no pertenece a esta organización');
    const raw = rows[0]?.capabilities;
    let parsed: unknown;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
      this.logger.warn(`Client capabilities invalid JSON for ${clientId}: ${err instanceof Error ? err.message : err}`);
      parsed = undefined;
    }
    return normalizeClientCapabilities(parsed as Parameters<typeof normalizeClientCapabilities>[0]);
  }

  private async uniqueSlug(baseValue: string) {
    const base = this.slug(baseValue) || 'reservas'; let candidate = base;
    while (await this.forms.exist({ where: { publicSlug: candidate } })) candidate = `${base}-${randomBytes(3).toString('hex')}`;
    return candidate;
  }

  /**
   * El enlace público pertenece a una empresa concreta. Una incorporación aún
   * puede tener formularios publicados mientras completa su puesta en marcha;
   * pausar o cancelar el servicio, en cambio, corta de inmediato reservas,
   * encuestas y conversiones. El equipo interno conserva su historial.
   */
  private async assertPublicClientCanReceiveRequests(organizationId: string, clientId: string, queryFn?: (sql: string, params?: unknown[]) => Promise<unknown[]>) {
    const q = queryFn || this.dataSource.query.bind(this.dataSource);
    const rows = await q('SELECT status FROM clients WHERE id = ? AND organization_id = ? LIMIT 1', [clientId, organizationId]);
    if (!Array.isArray(rows) || ['paused', 'churned'].includes(rows[0]?.status)) {
      throw new NotFoundException('Este formulario no está disponible');
    }
  }

  async createForm(organizationId: string, userId: string, dto: CreateReservationFormDto) {
    await this.assertClientOwnership(organizationId, dto.clientId);
    const capabilities = await this.clientCapabilities(organizationId, dto.clientId);
    if (!capabilities.reservations) throw new ForbiddenException('Reservas no está habilitado para esta empresa');
    const isSurvey = ['request', 'survey'].includes(dto.mode || '');
    const fieldSchema = isSurvey
      ? [
        { id: 'name', type: 'text', label: 'Nombre', required: true, system: true, placeholder: 'Nombre completo' },
        { id: 'email', type: 'email', label: 'Email (aquí enviaremos tu regalo)', required: true, system: true, placeholder: 'Email' },
        { id: 'phone', type: 'phone', label: 'WhatsApp', required: true, system: true, placeholder: '+56 9 ...' },
        { id: 'birthday', type: 'date', label: '¿Cuál es tu fecha de cumpleaños?', required: true },
        { id: 'consent', type: 'consent', label: 'Acepto los términos y condiciones proporcionados por la empresa. Al proporcionar mi número de WhatsApp acepto recibir promociones esporádicas.', required: true },
        { id: 'ad_influenced', type: 'select', label: '¿Viste algún anuncio publicitario que influyó en tu decisión de visitarnos?', required: true, options: ['Sí', 'No'] },
        { id: 'source', type: 'select', label: '¿Cómo nos conociste?', required: true, options: ['Recomendación de alguien', 'Vi un anuncio publicitario en Facebook/Instagram', 'Los vi mientras caminaba y entré', 'Ya los conocía, soy cliente'] },
        { id: 'served_by', type: 'text', label: '¿Podrías indicarnos quien te atendió durante tu visita?', required: true, placeholder: 'Ej: Juan' },
        { id: 'rating', type: 'rating', label: 'De 1 a 5 ¿Cómo calificarías la experiencia?', required: true },
      ]
      : [{ id: 'name', type: 'text', label: 'Nombre completo', required: true, system: true }, { id: 'email', type: 'email', label: 'Correo', required: false, system: true }, { id: 'phone', type: 'phone', label: 'Teléfono', required: true, system: true }, { id: 'consent', type: 'consent', label: 'Acepto el tratamiento de mis datos para gestionar esta reserva.', required: true }];
    const form = this.forms.create({
      organizationId, clientId: dto.clientId, createdBy: userId, name: dto.name.trim(), publicSlug: await this.uniqueSlug(dto.publicSlug || dto.name), mode: dto.mode || 'appointment',
      fieldSchema,
      designConfig: isSurvey
        ? { primaryColor: '#1f5b2d', accentColor: '#d79b3a', backgroundColor: '#f5eedf', textColor: '#263241', title: dto.name, welcome: 'Gracias por ser parte de nuestra experiencia. Tu opinión es fundamental para seguir mejorando.', confirmationMessage: 'Gracias por tu tiempo. Tu respuesta fue registrada.', backgroundMode: 'image', backgroundOpacity: '82', backgroundPosition: 'center', backgroundSize: 'cover', layoutPosition: 'center', buttonRadius: '6', fieldRadius: '6', fontFamily: 'Inter, sans-serif', showFacts: 'false', showSecureBadge: 'false', showPoweredBy: 'false', googleReviewUrl: '', googleReviewMinRating: '4' }
        : { primaryColor: '#173f35', accentColor: '#ea0f63', backgroundColor: '#f3f5ef', textColor: '#3f4e49', title: dto.name, welcome: 'Elige el horario que mejor te acomode.', backgroundMode: 'gradient', backgroundGradient: 'linear-gradient(135deg, #f3f5ef 0%, #dce9df 100%)', backgroundOpacity: '88', backgroundPosition: 'center', buttonRadius: '12', fieldRadius: '10', fontFamily: 'system-ui', venueTips: DEFAULT_VENUE_TIPS },
      scheduleConfig: { windows: [1,2,3,4,5].map((day) => ({ day, start: '09:00', end: '18:00' })) }, servicesConfig: [], resourcesConfig: [], crmEnabled: false, calendarEnabled: false, metaCapiEnabled: false,
    });
    this.validateConfiguration(form); return this.forms.save(form);
  }

  listForms(organizationId: string, clientId?: string, clientIds?: string[]) { return this.forms.find({ where: this.scope(organizationId, clientId, clientIds), order: { updatedAt: 'DESC' } }); }
  async getForm(organizationId: string, id: string, clientId?: string, clientIds?: string[]) { const form = await this.forms.findOne({ where: { id, ...this.scope(organizationId, clientId, clientIds) } }); if (!form) throw new NotFoundException('Formulario no encontrado'); return form; }
  async updateForm(organizationId: string, id: string, dto: UpdateReservationFormDto, clientId?: string, clientIds?: string[]) {
    const form = await this.getForm(organizationId, id, clientId, clientIds);
    const capabilities = await this.clientCapabilities(organizationId, form.clientId);
    if (!capabilities.reservations) throw new ForbiddenException('Reservas no está habilitado para esta empresa');
    // Reservas y CRM son capacidades independientes. No se crea ni sincroniza un lead
    // desde una reserva; se conserva la columna histórica solo para no borrar datos.
    if (dto.metaCapiEnabled && !capabilities.metaConversions) throw new BadRequestException('Meta Pixel + CAPI no está habilitado para esta empresa');
    Object.assign(form, Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)));
    form.crmEnabled = false;
    if (!capabilities.metaConversions) form.metaCapiEnabled = false;
    this.validateConfiguration(form);
    if (form.status === 'published' && ((form.scheduleConfig as { windows?: unknown[] }).windows?.length || 0) === 0) throw new BadRequestException('No puedes publicar sin disponibilidad');
    return this.forms.save(form);
  }
  async duplicateForm(organizationId: string, id: string, userId: string, clientIds?: string[]) { const source = await this.getForm(organizationId, id, undefined, clientIds); const copy = this.forms.create({ ...source, id: undefined, name: `${source.name} (copia)`, publicSlug: await this.uniqueSlug(source.publicSlug), status: 'draft', createdBy: userId, createdAt: undefined, updatedAt: undefined }); return this.forms.save(copy); }

  async addBlock(organizationId: string, formId: string, userId: string, dto: CreateBlockDto, clientId?: string, clientIds?: string[]) {
    const form = await this.getForm(organizationId, formId, clientId, clientIds);
    const startsAt = new Date(dto.startsAt); const endsAt = new Date(dto.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) throw new BadRequestException('El fin debe ser posterior al inicio');
    if (endsAt.getTime() - startsAt.getTime() > 366 * 86400000) throw new BadRequestException('Un bloqueo no puede superar 366 días');
    // Nunca ocultar ni cancelar reservas existentes al crear un evento privado: primero se
    // resuelven con el cliente y luego se cierra la franja.
    const affected = await this.reservations.createQueryBuilder('r').where('r.form_id = :formId AND r.starts_at < :endsAt AND r.ends_at > :startsAt AND r.status IN (:...statuses)', { formId, startsAt, endsAt, statuses: ACTIVE_STATUSES }).getCount();
    if (affected > 0) throw new ConflictException(`Hay ${affected} reserva(s) en este horario. Reagenda o contacta a esas personas antes de bloquearlo.`);
    return this.blocks.save(this.blocks.create({ organizationId, clientId: form.clientId, formId, createdBy: userId, startsAt, endsAt, reason: dto.reason?.trim() || undefined }));
  }
  async listBlocks(organizationId: string, formId: string, clientId?: string, clientIds?: string[]) { await this.getForm(organizationId, formId, clientId, clientIds); return this.blocks.find({ where: { organizationId, formId }, order: { startsAt: 'ASC' } }); }
  async removeBlock(organizationId: string, id: string, clientId?: string, clientIds?: string[], actorId?: string) { const block = await this.blocks.findOne({ where: { id, ...this.scope(organizationId, clientId, clientIds) } }); if (!block) throw new NotFoundException('Bloqueo no encontrado'); await this.blocks.remove(block); await this.audit.log({ organizationId, actorId, entityType: 'AvailabilityBlock', entityId: id, action: 'deleted', before: { startsAt: block.startsAt, endsAt: block.endsAt, reason: block.reason, formId: block.formId } }); return { deleted: true }; }

  private async publishedForm(slug: string, manager?: EntityManager, lock = false) {
    const repo = manager?.getRepository(ReservationForm) || this.forms;
    const qb = repo.createQueryBuilder('form').where('form.public_slug = :slug AND form.status = :status', { slug, status: 'published' }); if (lock) qb.setLock('pessimistic_write');
    const form = await qb.getOne(); if (!form) throw new NotFoundException('Este formulario no está disponible');
    await this.assertPublicClientCanReceiveRequests(form.organizationId, form.clientId, manager?.query.bind(manager));
    const capabilities = await this.clientCapabilities(form.organizationId, form.clientId, manager?.query.bind(manager));
    if (!capabilities.reservations) throw new NotFoundException('Este formulario no está disponible');
    // Un formulario publicado con configuracion invalida no debe mostrarle un error de validacion
    // al visitante: se registra para poder corregirlo y la pagina responde como no disponible.
    try { this.validateConfiguration(form); } catch (err) {
      this.logger.error(`Formulario publicado ${form.id} (${slug}) tiene configuración inválida: ${err instanceof Error ? err.message : err}`);
      throw new NotFoundException('Este formulario no está disponible');
    }
    return form;
  }
  async publicForm(slug: string) {
    const form = await this.publishedForm(slug);
    const capabilities = await this.clientCapabilities(form.organizationId, form.clientId);
    const meta = capabilities.metaConversions
      ? await this.getClientMetaConfig(form.clientId, form.organizationId, form)
      : { pixelId: '', pixelName: null as string | null, accessToken: undefined as string | undefined };
    const { services, resources } = this.configs(form);
    // Desactivar una zona o servicio nunca elimina su configuración ni afecta reservas
    // históricas; simplemente deja de ofrecerlo para nuevas reservas públicas.
    return { name: form.name, publicSlug: form.publicSlug, mode: form.mode, timezone: form.timezone, durationMinutes: form.durationMinutes, capacityPerSlot: form.capacityPerSlot, maximumAdvanceDays: form.maximumAdvanceDays, confirmationMode: form.confirmationMode, fieldSchema: (form.fieldSchema as FieldConfig[]).filter((field) => !field.internal), designConfig: form.designConfig, servicesConfig: services.filter((item) => item.active !== false), resourcesConfig: resources.filter((item) => item.active !== false), pixelId: meta.pixelId, pixelName: meta.pixelName || null, metaReady: Boolean(meta.pixelId && meta.accessToken), ga4MeasurementId: form.ga4MeasurementId || null };
  }

  async formContext(organizationId: string, clientId: string) {
    const capabilities = await this.clientCapabilities(organizationId, clientId);
    const { pixelId, pixelName, accessToken } = capabilities.metaConversions ? await this.getClientMetaConfig(clientId, organizationId) : { pixelId: '', pixelName: null, accessToken: undefined };
    return { capabilities, pixelId: pixelId || null, pixelName: pixelName || null, metaReady: Boolean(pixelId && accessToken) };
  }

  private effectiveRules(form: ReservationForm, serviceId?: string, resourceId?: string) {
    const { services, resources } = this.configs(form); const service = serviceId ? services.find((item) => item.id === serviceId) : undefined; const resource = resourceId ? resources.find((item) => item.id === resourceId) : undefined;
    if (serviceId && !service) throw new BadRequestException('Servicio inválido'); if (resourceId && !resource) throw new BadRequestException('Recurso inválido');
    if (service?.active === false) throw new BadRequestException('Este servicio ya no acepta nuevas reservas');
    if (resource?.active === false) throw new BadRequestException('Esta zona ya no acepta nuevas reservas');
    const duration = service?.durationMinutes || form.durationMinutes;
    const design = form.designConfig as DesignConfig;
    const numberRule = (value: unknown, fallback: number, min: number, max: number) => {
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
    };
    return { duration, capacity: Math.max(1, Math.min(service?.capacity || form.capacityPerSlot, resource?.capacity || form.capacityPerSlot)), windows: resource?.windows || ((form.scheduleConfig as { windows: ScheduleWindow[] }).windows), cadence: numberRule(design.slotCadenceMinutes, duration + form.bufferMinutes, 5, 240), lastReservableBeforeClose: numberRule(design.lastReservableMinutesBeforeClose, 0, 0, 360), service, resource };
  }

  private publicPauseUntil(form: ReservationForm): Date | undefined {
    const value = (form.designConfig as DesignConfig).bookingPausedUntil;
    if (!value) return undefined;
    const until = new Date(value);
    return Number.isNaN(until.getTime()) || until.getTime() <= Date.now() ? undefined : until;
  }

  private assertPublicBookingOpen(form: ReservationForm): void {
    const until = this.publicPauseUntil(form);
    if (until) throw new ConflictException(`Las reservas están pausadas hasta ${until.toLocaleString('es-CL', { timeZone: form.timezone, dateStyle: 'medium', timeStyle: 'short' })}`);
  }

  private usesCompanyDailyCap(form: ReservationForm): boolean {
    // Las configuraciones existentes conservan el comportamiento histórico hasta que la
    // empresa elija explícitamente independizar sus sedes.
    return (form.designConfig as DesignConfig).enforceCompanyDailyCap !== 'false';
  }

  private groupThreshold(form: ReservationForm): number {
    const value = Number((form.designConfig as DesignConfig).groupThreshold);
    return Number.isInteger(value) && value >= 2 && value <= 100 ? value : 8;
  }

  private assertScheduled(form: ReservationForm, startsAt: Date, serviceId?: string, resourceId?: string) {
    const rules = this.effectiveRules(form, serviceId, resourceId); const local = zonedParts(startsAt, form.timezone); const minute = local.hour * 60 + local.minute;
    const window = rules.windows.find((item) => item.day === local.weekday && minute >= this.minutes(item.start) && minute + rules.duration <= this.minutes(item.end) && minute <= this.minutes(item.end) - rules.lastReservableBeforeClose);
    if (!window || (minute - this.minutes(window.start)) % rules.cadence !== 0) throw new BadRequestException('El horario no pertenece a la disponibilidad publicada');
    const now = Date.now(); if (startsAt.getTime() < now + form.minimumNoticeHours * 3600000 || startsAt.getTime() > now + form.maximumAdvanceDays * 86400000) throw new BadRequestException('El horario está fuera del rango permitido');
    return rules;
  }

  /**
   * Toma el turno para crear reservas de un cliente en un día concreto.
   *
   * Serializa las reservas que compiten de verdad y deja avanzar en paralelo las que no. El
   * alcance es `(cliente, día)` porque el tope diario del cliente suma todos sus formularios:
   * bloquear solo el formulario dejaba que dos formularios de la misma cuenta contaran cero a la
   * vez y ambos insertaran, excediendo ese tope.
   *
   * Primero se asegura la fila y después se bloquea. La inserción puede perder la carrera contra
   * otra petición —de ahí el `IGNORE`—, pero entonces la fila ya existe y ambas terminan
   * bloqueando la misma. El bloqueo se libera al cerrar la transacción.
   */
  private async lockClientDay(manager: EntityManager, clientId: string, day: string): Promise<void> {
    await manager.query(
      'INSERT IGNORE INTO reservation_day_locks (id, client_id, day, created_at) VALUES (?, ?, ?, NOW())',
      [randomUUID(), clientId, day],
    );
    await manager.query(
      'SELECT id FROM reservation_day_locks WHERE client_id = ? AND day = ? FOR UPDATE',
      [clientId, day],
    );
  }

  private localDateKey(date: Date, timeZone: string) {
    const { year, month, day } = zonedParts(date, timeZone);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /**
   * Pixel y token con los que mide un formulario.
   *
   * Se pasa el formulario entero y no solo su empresa porque un formulario puede apartarse del
   * Pixel de ella: una empresa con varios proyectos los anuncia por separado y quiere medirlos
   * igual. Sin `metaPixelId` propio hereda el de la empresa, que es como funcionó siempre.
   *
   * Vale para reservas y encuestas: son la misma entidad con distinto `mode`.
   */
  private async getClientMetaConfig(clientId: string, organizationId: string, form?: ReservationForm) {
    return this.clientPixels.resolveForScope(organizationId, clientId, form?.metaPixelId);
  }

  /**
   * @param notify - Avisar al equipo. La importación masiva lo desactiva: cargar un histórico
   *   de quinientas filas generaba quinientas notificaciones y quinientos correos de "nueva
   *   reserva recibida" por reservas que ya ocurrieron.
   */
  async createManual(organizationId: string, userId: string, dto: CreateManualReservationDto, clientId?: string, clientIds?: string[], notify = true) {
    const form = await this.getForm(organizationId, dto.formId, clientId, clientIds);
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Fecha inválida');
    this.validateEmailDomain(dto.guestEmail);
    const guestName = dto.guestName.trim();
    if (!guestName) throw new BadRequestException('El nombre es obligatorio');
    const partySize = dto.partySize || 1;
    const result = await this.transaction('crear reserva manual', async (manager) => {
      // El alta manual compite por el mismo cupo que la publica, asi que toma el mismo turno:
      // el tope diario del cliente suma todos sus formularios y bloquear solo este dejaba que
      // dos altas de la misma cuenta contaran cero a la vez.
      await this.lockClientDay(manager, form.clientId, this.localDateKey(startsAt, form.timezone));
      let endsAt: Date;
      if (dto.skipAvailability) {
        const rules = this.effectiveRules(form, dto.serviceId, dto.resourceId);
        endsAt = new Date(startsAt.getTime() + rules.duration * 60000);
      } else {
        const available = await this.availability(manager, form, startsAt, partySize, dto.serviceId, dto.resourceId);
        endsAt = available.endsAt;
      }
      const booking = await manager.save(Reservation, manager.create(Reservation, {
        organizationId, clientId: form.clientId, formId: form.id, referenceCode: randomBytes(6).toString('hex').toUpperCase(),
        status: 'confirmed', startsAt, endsAt, partySize,
        guestName, guestEmail: dto.guestEmail?.trim().toLowerCase(), guestPhone: normalizePhone(dto.guestPhone),
        serviceId: dto.serviceId, resourceId: dto.resourceId, answers: dto.answers || {}, internalNotes: dto.internalNotes,
      }));
      await manager.save(ReservationEvent, manager.create(ReservationEvent, { organizationId, clientId: form.clientId, reservationId: booking.id, type: 'created', toStatus: 'confirmed', actorId: userId, actorType: 'team', metadata: { startsAt: startsAt.toISOString(), serviceId: dto.serviceId, resourceId: dto.resourceId, manual: true, skipAvailability: dto.skipAvailability } }));
      return { booking, form };
    });
    if (notify) await this.notifyNewBooking(result.form, result.booking);
    return result.booking;
  }

  /**
   * Cuenta reservas del día leyendo el estado **actual**, no la instantánea de la transacción.
   *
   * MariaDB trabaja en `REPEATABLE READ`: una consulta normal devuelve lo que había cuando la
   * transacción empezó. Dos reservas simultáneas tomaban el turno una tras otra, pero la segunda
   * seguía contando cero porque su instantánea era anterior a que la primera confirmara, y el
   * tope diario se excedía igual.
   *
   * `FOR UPDATE` obliga a leer lo que hay ahora. Es lo que convierte el turno en una garantía:
   * sin esto, el bloqueo ordena las transacciones pero cada una decide sobre datos viejos.
   *
   * @param excludeId - Reserva que no se cuenta, al reprogramar una existente.
   */
  private async dailyReservationsCount(manager: EntityManager, formId: string, dateKey: string, timeZone: string, excludeId?: string) {
    const start = startOfLocalDayUtc(dateKey, timeZone);
    const end = startOfLocalDayUtc(addPlainDays(dateKey, 1), timeZone);
    return this.currentReservationCount(manager, 'form_id', formId, start, end, excludeId);
  }

  /** Igual que el anterior, pero sobre el cliente: su tope suma todos sus formularios. */
  private async currentReservationCount(
    manager: EntityManager,
    column: 'form_id' | 'client_id',
    id: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ): Promise<number> {
    const placeholders = ACTIVE_STATUSES.map(() => '?').join(',');
    const params: unknown[] = [id, start, end, ...ACTIVE_STATUSES];
    let sql = `SELECT id, party_size FROM reservations WHERE ${column} = ? AND starts_at >= ? AND starts_at < ? AND status IN (${placeholders})`;
    if (excludeId) { sql += ' AND id != ?'; params.push(excludeId); }
    const rows = await manager.query(`${sql} FOR UPDATE`, params);
    // Los topes declarados en esta interfaz son comensales, no número de reservas:
    // una mesa para ocho no puede consumir el mismo cupo diario que una para una persona.
    return Array.isArray(rows) ? rows.reduce((total, row) => total + Math.max(1, Number(row.party_size ?? row.partySize ?? 1)), 0) : 0;
  }

  /**
   * Reservas del cliente en un dia, sumando todos sus formularios.
   *
   * El tope del cliente describe lo que su operacion puede atender en una jornada, asi que
   * cuenta el total del dia y no el de un formulario.
   */
  private async clientDailyReservationsCount(manager: EntityManager, clientId: string, dateKey: string, timeZone: string, excludeId?: string) {
    const start = startOfLocalDayUtc(dateKey, timeZone);
    const end = startOfLocalDayUtc(addPlainDays(dateKey, 1), timeZone);
    return this.currentReservationCount(manager, 'client_id', clientId, start, end, excludeId);
  }

  /**
   * Tope diario que el cliente declaro para toda su operacion, o 0 si no fijo ninguno.
   *
   * Se lee por consulta directa para no acoplar el modulo de reservas al de clientes.
   */
  /**
   * Zona horaria del cliente, tomada de sus formularios.
   *
   * Todos los formularios de un cliente describen el mismo local, así que basta con el
   * primero. Sin formularios se usa la zona por defecto, que es la misma que traen ellos.
   */
  private async clientTimezone(clientId: string, organizationId: string): Promise<string> {
    const form = await this.forms.findOne({
      where: { clientId, organizationId },
      select: { id: true, timezone: true },
    });
    return form?.timezone || 'America/Santiago';
  }

  private async clientDailyCap(runner: { query(sql: string, params?: unknown[]): Promise<any> }, clientId: string): Promise<number> {
    const rows = await runner.query('SELECT daily_reservation_cap FROM clients WHERE id = ?', [clientId]);
    return Number(rows?.[0]?.daily_reservation_cap ?? 0) || 0;
  }

  private async availability(manager: EntityManager, form: ReservationForm, startsAt: Date, partySize: number, serviceId?: string, resourceId?: string, excludeId?: string, excludeHoldKey?: string) {
    const rules = this.assertScheduled(form, startsAt, serviceId, resourceId); const endsAt = new Date(startsAt.getTime() + rules.duration * 60000);
    const block = await manager.getRepository(AvailabilityBlock).createQueryBuilder('b').where('b.form_id = :formId AND b.starts_at < :endsAt AND b.ends_at > :startsAt', { formId: form.id, startsAt, endsAt }).getOne(); if (block) throw new ConflictException('El horario está bloqueado');
    const dateKey = this.localDateKey(startsAt, form.timezone);
    if (form.dailyCapacity > 0) {
      const dailyCount = await this.dailyReservationsCount(manager, form.id, dateKey, form.timezone, excludeId);
      if (dailyCount + partySize > form.dailyCapacity) throw new ConflictException('Este día no tiene cupo para ese grupo');
    }
    // El tope del cliente se aplica ademas del propio del formulario: manda el mas estricto.
    const clientCap = this.usesCompanyDailyCap(form) ? await this.clientDailyCap(manager, form.clientId) : 0;
    if (clientCap > 0) {
      const clientCount = await this.clientDailyReservationsCount(manager, form.clientId, dateKey, form.timezone, excludeId);
      if (clientCount + partySize > clientCap) throw new ConflictException('Este día no tiene cupo para ese grupo');
    }
    const qb = manager.getRepository(Reservation).createQueryBuilder('r').where('r.form_id = :formId AND r.starts_at < :endsAt AND r.ends_at > :startsAt AND r.status IN (:...statuses)', { formId: form.id, startsAt, endsAt, statuses: ACTIVE_STATUSES }).setLock('pessimistic_write');
    if (resourceId) qb.andWhere('r.resource_id = :resourceId', { resourceId }); if (excludeId) qb.andWhere('r.id != :excludeId', { excludeId });
    const existing = await qb.getMany();
    const holdsQb = manager.getRepository(ReservationHold).createQueryBuilder('h')
      .where('h.form_id = :formId AND h.expires_at > :now AND h.starts_at < :endsAt AND h.ends_at > :startsAt', { formId: form.id, now: new Date(), startsAt, endsAt })
      .setLock('pessimistic_write');
    if (resourceId) holdsQb.andWhere('h.resource_id = :resourceId', { resourceId });
    if (excludeHoldKey) holdsQb.andWhere('h.hold_key != :excludeHoldKey', { excludeHoldKey });
    const activeHolds = await holdsQb.getMany();
    const used = existing.reduce((sum, item) => sum + item.partySize, 0) + activeHolds.reduce((sum, item) => sum + item.partySize, 0);
    if (used + partySize > rules.capacity) throw new ConflictException('Ese horario acaba de ocuparse. Selecciona una alternativa.');
    return { ...rules, endsAt, available: rules.capacity - used };
  }

  /** Texto generado por el servidor: el navegador no puede falsificar lo que se aceptó. */
  private consentTexts(form: ReservationForm) {
    const design = form.designConfig as DesignConfig;
    const controller = String(design.legalCompanyName || form.name).trim();
    const identifier = design.legalCompanyId ? `, ${String(design.legalCompanyId).trim()}` : '';
    const contact = design.supportEmail ? ` Puedes ejercer tus derechos de acceso, rectificación, supresión u oposición escribiendo a ${String(design.supportEmail).trim()}.` : '';
    const privacy = design.privacyUrl ? ` Revisa la política de privacidad en ${String(design.privacyUrl).trim()}.` : '';
    return {
      reservation: String(design.reservationConsentText || `Autorizo a ${controller}${identifier} a tratar mis datos de contacto y los antecedentes de esta solicitud exclusivamente para gestionar, confirmar, modificar o cancelar mi reserva y comunicarse conmigo respecto de ella.${contact}${privacy}`),
      marketing: String(design.marketingConsentText || `Autorizo voluntariamente a ${controller}${identifier} a enviarme novedades, promociones y comunicaciones comerciales por los datos de contacto indicados. Esta autorización es opcional, no condiciona mi reserva y puedo solicitar su revocación.${contact}${privacy}`),
    };
  }

  async slots(slug: string, from: string, days = 14, serviceId?: string, resourceId?: string, partySize = 1) {
    const form = await this.publishedForm(slug);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new BadRequestException('Fecha inválida');
    // El horizonte consultable es el mismo que el formulario permite reservar: pedir mas alla
    // de `maximumAdvanceDays` no puede devolver horarios, porque `maxStart` los descarta.
    const maxDays = Math.min(Math.max(form.maximumAdvanceDays, 1), MAX_SLOT_RANGE_DAYS);
    if (!Number.isInteger(days) || days < 1 || days > maxDays) throw new BadRequestException(`El rango debe contener entre 1 y ${maxDays} días`);
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 500) throw new BadRequestException('Cantidad de personas inválida');
    const pausedUntil = this.publicPauseUntil(form);
    if (pausedUntil) return { slots: [], fullDays: [], pausedUntil: pausedUntil.toISOString() };
    const rules = this.effectiveRules(form, serviceId, resourceId);
    const count = days;
    const rangeStart = startOfLocalDayUtc(from, form.timezone);
    const rangeEnd = startOfLocalDayUtc(addPlainDays(from, count), form.timezone);
    const existingQb = this.reservations.createQueryBuilder('r')
      .select(['r.id', 'r.startsAt', 'r.endsAt', 'r.partySize'])
      .where('r.form_id = :formId AND r.starts_at >= :start AND r.starts_at < :end AND r.status IN (:...statuses)', { formId: form.id, start: rangeStart, end: rangeEnd, statuses: ACTIVE_STATUSES });
    if (resourceId) existingQb.andWhere('r.resource_id = :resourceId', { resourceId });
    const blocksQb = this.blocks.createQueryBuilder('b')
      .select(['b.id', 'b.startsAt', 'b.endsAt'])
      .where('b.form_id = :formId AND b.starts_at < :end AND b.ends_at > :start', { formId: form.id, start: rangeStart, end: rangeEnd });
    const holdsQb = this.holds?.createQueryBuilder('h').where('h.form_id = :formId AND h.expires_at > :now AND h.starts_at < :end AND h.ends_at > :start', { formId: form.id, now: new Date(), start: rangeStart, end: rangeEnd });
    if (resourceId) holdsQb?.andWhere('h.resource_id = :resourceId', { resourceId });
    const [existing, blocks, holds] = await Promise.all([existingQb.getMany(), blocksQb.getMany(), holdsQb ? holdsQb.getMany() : Promise.resolve([] as ReservationHold[])]);
    // El tope efectivo del dia es el mas estricto entre el del formulario y el del cliente.
    // El del cliente cuenta las reservas de todos sus formularios, no solo las de este.
    const clientCap = this.usesCompanyDailyCap(form) ? await this.clientDailyCap(this.dataSource, form.clientId) : 0;
    const clientCounts = new Map<string, number>();
    if (clientCap > 0) {
      const clientRows = await this.reservations.createQueryBuilder('r')
        .where('r.client_id = :clientId AND r.starts_at >= :start AND r.starts_at < :end AND r.status IN (:...statuses)', { clientId: form.clientId, start: rangeStart, end: rangeEnd, statuses: ACTIVE_STATUSES })
        .getMany();
      for (const item of clientRows) {
        const key = this.localDateKey(item.startsAt, form.timezone);
        clientCounts.set(key, (clientCounts.get(key) ?? 0) + item.partySize);
      }
    }
    const dailyCounts = new Map<string, number>();
    const reservationsByDate = new Map<string, Reservation[]>();
    const holdsByDate = new Map<string, ReservationHold[]>();
    const blocksByDate = new Map<string, AvailabilityBlock[]>();
    if (form.dailyCapacity > 0) {
      for (const item of existing) {
        const key = this.localDateKey(item.startsAt, form.timezone);
        dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + item.partySize);
      }
    }
    for (const item of existing) {
      const key = this.localDateKey(item.startsAt, form.timezone);
      const list = reservationsByDate.get(key) || [];
      list.push(item);
      reservationsByDate.set(key, list);
    }
    for (const item of holds) {
      const key = this.localDateKey(item.startsAt, form.timezone);
      const list = holdsByDate.get(key) || [];
      list.push(item);
      holdsByDate.set(key, list);
    }
    const lastRequestedDate = addPlainDays(from, count - 1);
    for (const block of blocks) {
      const startKey = this.localDateKey(block.startsAt, form.timezone);
      const endKey = this.localDateKey(block.endsAt, form.timezone);
      const firstKey = startKey < from ? from : startKey;
      const lastKey = endKey > lastRequestedDate ? lastRequestedDate : endKey;
      for (let key = firstKey; key <= lastKey; key = addPlainDays(key, 1)) {
        const list = blocksByDate.get(key) || [];
        list.push(block);
        blocksByDate.set(key, list);
      }
    }
    const result: Array<{ startsAt: string; available: number }> = [];
    const windowsByWeekday = new Map<number, ScheduleWindow[]>();
    for (const window of rules.windows) {
      const list = windowsByWeekday.get(window.day) || [];
      list.push(window);
      windowsByWeekday.set(window.day, list);
    }
    const minStart = Date.now() + form.minimumNoticeHours * 3600000;
    const maxStart = Date.now() + form.maximumAdvanceDays * 86400000;
    // Un dia sin horarios puede estarlo por dos motivos que el comensal distingue: el local
    // no abre (o esta bloqueado) o ya alcanzo su tope diario. Solo el segundo es "completo".
    const fullDays: string[] = [];
    for (let offset = 0; offset < count; offset += 1) {
      const date = addPlainDays(from, offset);
      const { weekday } = plainDateParts(date);
      const dayWindows = windowsByWeekday.get(weekday) || [];
      const formFull = form.dailyCapacity > 0 && (dailyCounts.get(date) ?? 0) + partySize > form.dailyCapacity;
      const clientFull = clientCap > 0 && (clientCounts.get(date) ?? 0) + partySize > clientCap;
      if (formFull || clientFull) {
        if (dayWindows.length > 0) fullDays.push(date);
        continue;
      }
      const dayReservations = reservationsByDate.get(date) || [];
      const dayHolds = holdsByDate.get(date) || [];
      const dayBlocks = blocksByDate.get(date) || [];
      for (const window of dayWindows) {
        for (let minute = this.minutes(window.start); minute + rules.duration <= this.minutes(window.end) && minute <= this.minutes(window.end) - rules.lastReservableBeforeClose; minute += rules.cadence) {
          // Un cupo que cae en el salto de horario de verano no existe como hora local, así
          // que se omite en vez de tumbar la consulta entera del calendario.
          const startsAt = tryLocalToUtc(date, `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`, form.timezone);
          if (!startsAt) continue;
          const endsAt = new Date(startsAt.getTime() + rules.duration * 60000);
          if (startsAt.getTime() < minStart || startsAt.getTime() > maxStart) continue;
          if (dayBlocks.some((block) => this.overlaps(startsAt, endsAt, block.startsAt, block.endsAt))) continue;
          const used = dayReservations.reduce((sum, item) => this.overlaps(startsAt, endsAt, item.startsAt, item.endsAt) ? sum + item.partySize : sum, 0) + dayHolds.reduce((sum, item) => this.overlaps(startsAt, endsAt, item.startsAt, item.endsAt) ? sum + item.partySize : sum, 0);
          if (used + partySize <= rules.capacity) result.push({ startsAt: startsAt.toISOString(), available: rules.capacity - used });
        }
      }
    }
    return { slots: result, fullDays };
  }

  async trackPublicEvent(slug: string, dto: PublicFormEventDto, ipAddress?: string, userAgent?: string) {
    const form = await this.publishedForm(slug);
    if (dto.sessionId) {
      const existing = await this.formEvents.findOne({ where: { formId: form.id, type: dto.type, sessionId: dto.sessionId } });
      // Ya registrado: no se reenvía a Meta. La deduplicación por `eventId` la cubriría, pero
      // gastar la llamada igual llena la cola de duplicados que se descartan al otro lado.
      if (existing) return existing;
    }
    const saved = await this.saveFormEventOnce(
      this.formEvents.create({ organizationId: form.organizationId, clientId: form.clientId, formId: form.id, type: dto.type, sessionId: dto.sessionId, utmSource: dto.utmSource, utmMedium: dto.utmMedium, utmCampaign: dto.utmCampaign, utmContent: dto.utmContent }),
    );

    if (dto.type === 'start' && dto.measurementConsent) {
      await this.enqueueMetaInitiateCheckout(saved, form, dto, ipAddress, userAgent);
    }
    return saved;
  }

  /**
   * Avisa a Meta de que alguien empezó a llenar el formulario.
   *
   * Sin este evento Meta solo ve dos momentos —quien aterriza y quien reserva— y entre ambos
   * puede haber semanas de campaña sin señal. `InitiateCheckout` le da el paso intermedio, que
   * es lo que necesita para optimizar hacia gente que se interesa y no solo hacia tráfico.
   *
   * En este momento la persona todavía no dio correo ni teléfono, así que lo único con lo que
   * Meta puede emparejar es lo que trae el navegador: `fbp`, `fbc`, IP y user-agent. Por eso el
   * evento vale sobre todo cuando el Pixel está bloqueado, que es justo cuando el navegador no
   * lo manda por su cuenta.
   *
   * Nunca interrumpe el registro del evento: la analítica propia del formulario no depende de
   * que Meta esté configurado ni de que responda.
   */
  private async enqueueMetaInitiateCheckout(
    event: ReservationFormEvent,
    form: ReservationForm,
    dto: PublicFormEventDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      if (!form.metaCapiEnabled) return;
      const capabilities = await this.clientCapabilities(form.organizationId, form.clientId);
      if (!capabilities.metaConversions) return;

      const { pixelId, accessToken } = await this.getClientMetaConfig(form.clientId, form.organizationId, form);
      if (!pixelId || !accessToken) return;

      const fallbackUrl = process.env.APP_PUBLIC_URL
        ? `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/book/${encodeURIComponent(form.publicSlug)}`
        : undefined;

      await this.metaOutbox.enqueue(form.organizationId, pixelId, {
        eventName: META_DEDUPLICATED_EVENTS.INITIATE_CHECKOUT,
        eventTime: Math.floor(event.createdAt.getTime() / 1000),
        actionSource: 'website',
        eventSourceUrl: dto.eventSourceUrl || fallbackUrl || undefined,
        userData: {
          externalId: [event.id],
          fbc: dto.fbc ?? undefined,
          fbp: dto.fbp ?? undefined,
          client_ip_address: ipAddress ?? undefined,
          client_user_agent: userAgent ?? undefined,
        },
        customData: { contentIds: [form.id], contentType: 'reservation' },
        // Mismo identificador que dispara el navegador, o Meta cuenta el inicio dos veces.
        eventId: metaEventId(META_DEDUPLICATED_EVENTS.INITIATE_CHECKOUT, event.id),
      }, form.clientId);
    } catch (err) {
      this.logger.warn(`Meta CAPI InitiateCheckout enqueue failed for form event ${event.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Guarda un evento de formulario resolviendo el choque contra la restricción de unicidad.
   *
   * La consulta previa no basta: entre esa consulta y el `save` cabe otra petición, y a
   * diferencia de las reservas no hay bloqueo que las serialice. La base decide quién gana y
   * el que pierde recupera la fila del otro, de modo que un doble clic devuelve la misma
   * respuesta en vez de crear una segunda —que, además de duplicar el registro, encolaba una
   * conversión `Lead` extra hacia Meta.
   */
  private async saveFormEventOnce(event: ReservationFormEvent): Promise<ReservationFormEvent> {
    try {
      return await this.formEvents.save(event);
    } catch (error) {
      if ((error as { code?: string })?.code !== 'ER_DUP_ENTRY') throw error;
      const existing = await this.formEvents.findOne({
        where: { formId: event.formId, type: event.type, sessionId: event.sessionId },
      });
      if (!existing) throw error;
      return existing;
    }
  }

  async createPublicSurveyResponse(slug: string, dto: PublicSurveyResponseDto, ipAddress?: string, userAgent?: string, eventSourceUrl?: string) {
    if (dto.website) throw new BadRequestException('Solicitud inválida');
    const form = await this.publishedForm(slug);
    if (!['request', 'survey'].includes(form.mode)) throw new BadRequestException('Este enlace requiere selección de horario');
    this.validateSubmission(form, dto.answers, dto);
    this.validateEmailDomain(dto.guestEmail);
    const existing = await this.formEvents.findOne({ where: { formId: form.id, type: 'submit', sessionId: dto.idempotencyKey } });
    if (existing) return existing;
    const response = await this.saveFormEventOnce(this.formEvents.create({
      organizationId: form.organizationId,
      clientId: form.clientId,
      formId: form.id,
      type: 'submit',
      sessionId: dto.idempotencyKey,
      utmSource: dto.utmSource,
      utmMedium: dto.utmMedium,
      utmCampaign: dto.utmCampaign,
      utmContent: dto.utmContent,
      metadata: {
        guestName: dto.guestName.trim(),
        guestEmail: dto.guestEmail?.trim().toLowerCase(),
        guestPhone: normalizePhone(dto.guestPhone),
        answers: dto.answers,
        clickId: dto.clickId,
        // El formulario en caché todavía manda `clickId`; se interpreta como `gclid` porque
        // ese era su destino real. Un `gclid` explícito manda sobre él.
        gclid: dto.gclid ?? dto.clickId,
        gbraid: dto.gbraid,
        wbraid: dto.wbraid,
        fbclid: dto.fbclid,
        fbc: dto.fbc,
        fbp: dto.fbp,
        clientIpAddress: ipAddress,
        clientUserAgent: userAgent,
      },
    }));
    const capabilities = await this.clientCapabilities(form.organizationId, form.clientId);
    if (dto.measurementConsent && form.metaCapiEnabled && capabilities.metaConversions) {
      try {
        await this.enqueueMetaSurveyConversion(response, form, dto, ipAddress, userAgent, eventSourceUrl);
      } catch (err) {
        this.logger.warn(`Meta CAPI survey enqueue failed for response ${response.id}: ${err instanceof Error ? err.message : err}`);
      }
    }
    await this.flagLowRatingSurvey(form, response, dto);
    return response;
  }

  /**
   * Detecta una encuesta post-visita con calificación baja y abre una solicitud de contacto
   * para que el equipo la siga, además de notificar a quien corresponde.
   *
   * El rating bajo no rechaza ni altera la respuesta: se guarda y se gestiona aparte, porque
   * quien respondió mal ya entregó su opinión y esa fila debe quedar intacta.
   */
  private async flagLowRatingSurvey(form: ReservationForm, response: ReservationFormEvent, dto: PublicSurveyResponseDto): Promise<void> {
    const fields = (form.fieldSchema ?? []) as FieldConfig[];
    const ratingField = fields.find((field) => field.type === 'rating');
    const rawRating = ratingField ? dto.answers[ratingField.id] : undefined;
    const rating = typeof rawRating === 'string' && rawRating !== '' ? Number(rawRating) : typeof rawRating === 'number' ? rawRating : Number.NaN;
    if (!Number.isFinite(rating) || rating >= 4) return;
    const commentField = fields.find((field) => field.type === 'textarea' || field.type === 'text' || /comment|mensaje|message|opinion/i.test(field.id));
    const message = commentField ? String(dto.answers[commentField.id] ?? '').trim() : undefined;
    try {
      await this.surveyContacts.save(this.surveyContacts.create({
        organizationId: form.organizationId,
        clientId: form.clientId,
        formId: form.id,
        responseId: response.id,
        guestName: dto.guestName.trim(),
        email: dto.guestEmail?.trim().toLowerCase(),
        phone: dto.guestPhone ? normalizePhone(dto.guestPhone) : undefined,
        message,
        rating: Math.round(rating),
        status: 'pending',
      }));
      await this.notifySurveyContact(form, dto.guestName.trim(), rating, message);
    } catch (err) {
      this.logger.warn(`Survey contact request failed for response ${response.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Notifica al equipo (community manager de la cuenta y administración) que una encuesta
   * llegó con calificación baja y hay una persona por contactar.
   */
  private async notifySurveyContact(form: ReservationForm, guestName: string, rating: number, message?: string): Promise<void> {
    try {
      const rows = await this.dataSource.query(
        `SELECT DISTINCT id FROM users WHERE organization_id = ? AND is_active = 1 AND (client_id = ? OR role IN ('admin', 'community_manager'))`,
        [form.organizationId, form.clientId],
      );
      const userIds = (rows as Array<{ id: string }>).map((row) => row.id).filter(Boolean);
      if (userIds.length > 0) {
        await this.notifications.notifyMultiple(
          form.organizationId,
          userIds,
          'survey_low_rating',
          'Encuesta con calificación baja',
          `${guestName} calificó con ${rating}/5 en ${form.name}. Revisa la respuesta y contacta a la persona.${message ? ` Mensaje: ${message}` : ''}`,
          { formId: form.id, clientId: form.clientId, responseId: undefined, rating },
        );
      }
    } catch (err) {
      this.logger.warn(`Survey low rating notification failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async listSurveyContactRequests(organizationId: string, clientId?: string, clientIds?: string[]): Promise<SurveyContactRequest[]> {
    return this.surveyContacts.find({
      where: this.scope(organizationId, clientId, clientIds),
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async updateSurveyContactRequest(organizationId: string, id: string, body: { status?: string; notes?: string }, clientId?: string, clientIds?: string[], actorId?: string): Promise<SurveyContactRequest> {
    const row = await this.surveyContacts.findOne({ where: { id, ...this.scope(organizationId, clientId, clientIds) } });
    if (!row) throw new NotFoundException('La solicitud de contacto no existe');
    if (body.status) row.status = body.status;
    if (body.notes !== undefined) row.notes = body.notes;
    if (body.status === 'resolved') {
      row.resolvedAt = new Date();
      row.resolvedBy = actorId ?? null;
    }
    return this.surveyContacts.save(row);
  }

  /**
   * Comprueba que el dominio del correo tenga registros MX y lo anota si no.
   *
   * No rechaza nada: la única rama negativa deja una fila de auditoría. Por eso **no se
   * espera su resultado** en el camino de creación —esperarlo sumaba la ida y vuelta al DNS,
   * que con un dominio que no responde son decenas de segundos por los reintentos del
   * resolver, a la latencia del botón "Reservar" y a cada fila de una importación.
   *
   * El formato del correo ya lo valida el DTO con `@IsEmail`, así que esto solo aporta la
   * señal de que un dominio no recibe correo.
   */
  private validateEmailDomain(email?: string): void {
    if (!email) return;
    const domain = email.split('@')[1];
    if (!domain) return;
    void dns.resolveMx(domain)
      .then((mx) => { if (!mx || mx.length === 0) this.reportBadEmail(domain); })
      .catch((err) => this.logger.warn(`MX lookup failed for domain ${domain}: ${err instanceof Error ? err.message : err}`));
  }
  private reportBadEmail(_domain: string) {
    this.dataSource.query('INSERT INTO audit_logs (organization_id, entity_type, entity_id, action, metadata, occurred_at) VALUES (?, ?, ?, ?, ?, NOW())', [null, 'email_validation', _domain, 'mx_failed', JSON.stringify({ domain: _domain })]).catch(() => undefined);
  }

  private managementHash(token: string) { return createHash('sha256').update(token).digest('hex'); }

  private async createManagementToken(reservationId: string, endsAt: Date, manager?: EntityManager): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const repository = manager?.getRepository(ReservationManagementToken) || this.managementTokens;
    if (!repository) throw new Error('El repositorio de enlaces de gestión no está disponible');
    await repository.save(repository.create({ reservationId, tokenHash: this.managementHash(token), expiresAt: new Date(endsAt.getTime() + GESTION_TRAS_LA_VISITA_DIAS * 86400000) }));
    return token;
  }

  private async managementReservation(token: string) {
    const record = await this.managementTokens.findOne({ where: { tokenHash: this.managementHash(token) } });
    if (!record || record.revokedAt || record.expiresAt <= new Date()) throw new NotFoundException('El enlace de gestión no está disponible');
    const reservation = await this.reservations.findOne({ where: { id: record.reservationId } });
    if (!reservation) throw new NotFoundException('La reserva no existe');
    return { record, reservation };
  }

  /**
   * Entrega un enlace de gestión a quien demuestra que la reserva es suya.
   *
   * El enlace solo existía en la pantalla de éxito y en los correos: desde otro dispositivo, o
   * con los correos apagados, no había forma de cancelar ni de cambiar la hora sin llamar al
   * local. Pide dos datos que solo tiene quien reservó —el código y el correo o teléfono— y
   * responde lo mismo si falla cualquiera de los dos, para no confirmar que un código existe.
   */
  async lookupPublicReservation(slug: string, referenceCode: string, contact: string) {
    const noEncontrada = new NotFoundException('No encontramos una reserva con esos datos. Revisa el código y el correo o teléfono con que reservaste.');
    const form = await this.forms.findOne({ where: { publicSlug: slug } });
    if (!form) throw noEncontrada;
    // En cualquier local de la misma empresa: quien reservó en otra sucursal no tiene por qué saber
    // en qué página hacerlo. Nunca cruza a otra empresa, porque la búsqueda va por su `clientId`.
    const booking = await this.reservations.findOne({ where: { organizationId: form.organizationId, clientId: form.clientId, referenceCode: referenceCode.trim().toUpperCase() } });
    if (!booking) throw noEncontrada;
    const dato = contact.trim();
    const coincide = dato.includes('@')
      ? Boolean(booking.guestEmail) && booking.guestEmail!.toLowerCase() === dato.toLowerCase()
      : Boolean(booking.guestPhone) && normalizePhone(dato) === booking.guestPhone;
    if (!coincide) throw noEncontrada;
    return { token: await this.createManagementToken(booking.id, booking.endsAt) };
  }

  /**
   * Reenvía el enlace de gestión al correo con que se reservó, para quien perdió el código.
   *
   * No muestra nada en pantalla: si listara reservas por correo, cualquiera podría escribir el
   * correo de otra persona y cancelarle la mesa. El enlace llega a esa bandeja y solo lo abre
   * quien tiene acceso a ella. Por lo mismo la respuesta es siempre igual, haya o no reservas.
   *
   * Busca en todos los locales de la misma empresa y en reservas que todavía pueden cambiarse. Tiene interruptor propio,
   * encendido de fábrica: lo pide la persona, no es un aviso que decida el local.
   */
  async recoverPublicReservations(slug: string, email: string) {
    const respuesta = { sent: true };
    const correo = email.trim().toLowerCase();
    const form = await this.forms.findOne({ where: { publicSlug: slug } });
    if (!form || !correo.includes('@')) return respuesta;
    const plantilla = await this.plantillaDeAviso(form, 'email.reservation_recovery');
    if (!plantilla.encendido) return respuesta;
    // Todas las sucursales de la misma empresa, nunca otra empresa.
    const reservas = await this.reservations.find({
      where: { organizationId: form.organizationId, clientId: form.clientId, guestEmail: correo, status: In(ACTIVE_STATUSES), startsAt: MoreThan(new Date()) },
      order: { startsAt: 'ASC' },
      take: 5,
    });
    if (reservas.length === 0) return respuesta;
    // Cada correo nombra el local donde está esa reserva, que puede no ser el de esta página.
    const locales = new Map(((await this.forms.find({ where: { id: In([...new Set(reservas.map((item) => item.formId))]) } })) ?? []).map((local) => [local.id, local]));
    const base = process.env.APP_PUBLIC_URL?.replace(/\/$/, '');
    for (const booking of reservas) {
      const local = locales.get(booking.formId) ?? form;
      const token = await this.createManagementToken(booking.id, booking.endsAt);
      const url = base ? `${base}/book/manage/${token}` : undefined;
      const { subject, html } = componerCorreo(plantilla.asunto, plantilla.cuerpo,
        { nombre: booking.guestName, local: local.name, fecha: booking.startsAt.toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short', timeZone: local.timezone }), personas: booking.partySize, codigo: booking.referenceCode },
        url ? { texto: 'Gestionar mi reserva', url } : undefined);
      void this.emails.send(correo, subject, html, { replyTo: this.respuestaAlLocal(local) })
        .catch((err) => this.logger.warn(`Enlace de gestión de ${booking.id} no enviado: ${err instanceof Error ? err.message : err}`));
    }
    return respuesta;
  }

  async publicManagement(token: string) {
    const { reservation } = await this.managementReservation(token);
    const form = await this.forms.findOne({ where: { id: reservation.formId } });
    if (!form) throw new NotFoundException('El formulario ya no existe');
    return { referenceCode: reservation.referenceCode, guestName: reservation.guestName, startsAt: reservation.startsAt, endsAt: reservation.endsAt, partySize: reservation.partySize, serviceId: reservation.serviceId, resourceId: reservation.resourceId, status: reservation.status, guestConfirmedAt: reservation.guestConfirmedAt, canCancel: ACTIVE_STATUSES.includes(reservation.status), canReschedule: ACTIVE_STATUSES.includes(reservation.status), publicSlug: form.publicSlug, timezone: form.timezone, maxPartySize: this.groupThreshold(form), localName: form.name };
  }

  async cancelPublicManagement(token: string) {
    const { record, reservation } = await this.managementReservation(token);
    if (!ACTIVE_STATUSES.includes(reservation.status)) throw new ConflictException('Esta reserva ya no se puede cancelar');
    const saved = await this.transaction('cancelar reserva pública', async (manager) => {
      const booking = await manager.getRepository(Reservation).createQueryBuilder('r').setLock('pessimistic_write').where('r.id = :id', { id: reservation.id }).getOne();
      if (!booking || !ACTIVE_STATUSES.includes(booking.status)) throw new ConflictException('Esta reserva ya no se puede cancelar');
      const previous = booking.status; booking.status = 'cancelled_client';
      await manager.save(booking);
      await this.devolverCupon(manager, booking);
      await manager.save(ReservationEvent, manager.create(ReservationEvent, { organizationId: booking.organizationId, clientId: booking.clientId, reservationId: booking.id, type: 'cancelled', fromStatus: previous, toStatus: booking.status, actorType: 'guest', metadata: { via: 'management_link' } }));
      return booking;
    });
    record.usedAt = new Date();
    await this.managementTokens.save(record);
    void this.sendCalendarUpdate(reservation, 'CANCELLED');
    void this.avisarCupoLiberado(saved);
    return { cancelled: true, referenceCode: saved.referenceCode, status: saved.status };
  }

  async confirmPublicManagement(token: string) {
    const { record, reservation } = await this.managementReservation(token);
    if (!ACTIVE_STATUSES.includes(reservation.status)) throw new ConflictException('Esta reserva ya no se puede confirmar');
    if (!reservation.guestConfirmedAt) {
      reservation.guestConfirmedAt = new Date();
      await this.reservations.save(reservation);
    }
    record.usedAt = new Date();
    await this.managementTokens.save(record);
    await this.events.save(this.events.create({ organizationId: reservation.organizationId, clientId: reservation.clientId, reservationId: reservation.id, type: 'guest_confirmed', fromStatus: reservation.status, toStatus: reservation.status, actorType: 'guest', metadata: { via: 'management_link' } }));
    return { confirmed: true, referenceCode: reservation.referenceCode };
  }

  /**
   * Usuarios y correos del equipo que atiende un local.
   *
   * Es el mismo criterio del aviso de reserva nueva: quien pertenece a la empresa, mas su
   * responsable de cuenta, y los correos anotados en los ajustes del local.
   */
  private async equipoDelLocal(form: ReservationForm): Promise<{ userIds: string[]; correos: string[] }> {
    const rows = await this.dataSource.query(`SELECT DISTINCT id FROM users WHERE organization_id = ? AND is_active = 1 AND (client_id = ? OR id = (SELECT community_manager_id FROM clients WHERE id = ? AND organization_id = ?))`, [form.organizationId, form.clientId, form.clientId, form.organizationId]);
    return {
      userIds: (rows as Array<{ id: string }>).map((row) => row.id).filter(Boolean),
      correos: (form.teamNotifications || []).filter((email) => typeof email === 'string' && email.includes('@')),
    };
  }

  /**
   * Avisa al equipo y responde a quien escribio, sin poder romper lo que ya se guardo.
   *
   * Lo usan la solicitud de grupo y la lista de espera: hasta ahora ninguna de las dos avisaba
   * a nadie. La persona no sabia si su pedido habia llegado y el equipo solo lo veia si abria la
   * pantalla justa. El acuse respeta el mismo interruptor que el comprobante de reserva.
   */
  private async avisarSolicitudSinCupo(form: ReservationForm, tipo: 'grupo' | 'espera', datos: { id: string; guestName: string; guestEmail?: string | null; partySize: number; cuando: string }): Promise<void> {
    const variables = { nombre: datos.guestName, local: form.name, fecha: datos.cuando, personas: datos.partySize };
    try {
      const equipo = await this.equipoDelLocal(form);
      if (equipo.userIds.length) {
        await this.notifications.notifyMultiple(form.organizationId, equipo.userIds, tipo === 'grupo' ? 'reservation_group_request' : 'reservation_waitlist', tipo === 'grupo' ? 'Nueva solicitud de grupo' : 'Nueva persona en lista de espera', `${datos.guestName} · ${datos.partySize} personas · ${datos.cuando} · ${form.name}.`, { formId: form.id, clientId: form.clientId, requestId: datos.id });
      }
      if (equipo.correos.length) {
        const plantilla = await this.plantillaDeAviso(form, tipo === 'grupo' ? 'email.team_group_request' : 'email.team_waitlist');
        if (plantilla.encendido) {
          const { subject, html } = componerCorreo(plantilla.asunto, plantilla.cuerpo, variables);
          void Promise.all(equipo.correos.map((email) => this.emails.send(email, subject, html)))
            .catch((err) => this.logger.warn(`Aviso al equipo de ${datos.id} no enviado: ${err instanceof Error ? err.message : err}`));
        }
      }
    } catch (err) {
      this.logger.warn(`No se pudo avisar al equipo de ${datos.id}: ${err instanceof Error ? err.message : err}`);
    }
    try {
      if (!datos.guestEmail) return;
      const plantilla = await this.plantillaDeAviso(form, tipo === 'grupo' ? 'email.group_request_ack' : 'email.waitlist_ack');
      if (!plantilla.encendido) return;
      const { subject, html } = componerCorreo(plantilla.asunto, plantilla.cuerpo, variables);
      void this.emails.send(datos.guestEmail, subject, html, { replyTo: this.respuestaAlLocal(form) })
        .catch((err) => this.logger.warn(`Acuse de ${datos.id} no enviado: ${err instanceof Error ? err.message : err}`));
    } catch (err) {
      this.logger.warn(`No se pudo componer el acuse de ${datos.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Avisa a quienes esperaban ese horario que se libero un cupo.
   *
   * No reserva nada por ellos: el cupo lo toma quien reserve primero en la pagina, que es la
   * unica forma de no prometerle la misma mesa a dos personas. El aviso lleva al local.
   */
  private async avisarCupoLiberado(booking: Reservation): Promise<void> {
    try {
      const form = await this.forms.findOne({ where: { id: booking.formId } });
      if (!form || form.status !== 'published' || booking.startsAt <= new Date()) return;
      const plantilla = await this.plantillaDeAviso(form, 'email.waitlist_spot');
      if (!plantilla.encendido) return;
      const esperando = await this.reservations.find({ where: { formId: form.id, status: 'waitlist', startsAt: booking.startsAt }, take: 20 });
      const url = process.env.APP_PUBLIC_URL ? `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/book/${form.publicSlug}` : undefined;
      const cuando = booking.startsAt.toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short', timeZone: form.timezone });
      for (const persona of esperando) {
        if (!persona.guestEmail) continue;
        const { subject, html } = componerCorreo(plantilla.asunto, plantilla.cuerpo,
          { nombre: persona.guestName, local: form.name, fecha: cuando },
          url ? { texto: 'Reservar ahora', url } : undefined);
        void this.emails.send(persona.guestEmail, subject, html, { replyTo: this.respuestaAlLocal(form) })
          .catch((err) => this.logger.warn(`Aviso de cupo a ${persona.id} no enviado: ${err instanceof Error ? err.message : err}`));
      }
    } catch (err) {
      this.logger.warn(`No se pudo avisar a la lista de espera de ${booking.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Devuelve el uso del cupón de una reserva que se cancela.
   *
   * El uso se descontaba al reservar y nunca volvía: un cupón de diez usos quedaba agotado con
   * diez reservas aunque nueve se hubieran cancelado.
   */
  private async devolverCupon(manager: EntityManager, booking: Reservation): Promise<void> {
    if (!booking.couponCode) return;
    await manager.getRepository(ReservationCoupon).createQueryBuilder().update(ReservationCoupon)
      .set({ usageCount: () => 'GREATEST(usage_count - 1, 0)' })
      .where('organization_id = :org AND code = :code', { org: booking.organizationId, code: booking.couponCode })
      .execute();
  }

  /**
   * Plantilla de un aviso a quien reserva: si está encendido y con qué texto.
   *
   * Sale de Ajustes por empresa, como la confirmación y el recordatorio. Si el ajuste no responde,
   * se usa el valor de fábrica del mismo catálogo, para que el texto de respaldo viva en un solo
   * lugar y no se desalinee del que ve quien edita.
   */
  private async plantillaDeAviso(form: ReservationForm, prefijo: string): Promise<{ encendido: boolean; asunto: string; cuerpo: string }> {
    const deFabrica = (parte: string) => ORGANIZATION_SETTINGS.find((ajuste) => ajuste.key === `${prefijo}_${parte}`)?.defaultValue;
    const [encendido, asunto, cuerpo] = await Promise.all(['enabled', 'subject', 'body']
      .map((parte) => this.parametros.get(`${prefijo}_${parte}`, form.clientId, null, form.organizationId)));
    return {
      encendido: Boolean(encendido ?? deFabrica('enabled')),
      asunto: String(asunto ?? deFabrica('subject') ?? ''),
      cuerpo: String(cuerpo ?? deFabrica('body') ?? ''),
    };
  }

  /**
   * Buzón al que debe llegar la respuesta de quien reserva.
   *
   * El remitente es único para todo el sistema —lo fija `SMTP_FROM`—, así que sin esto una
   * respuesta a «tu reserva está confirmada» aterriza en la agencia, que no sabe nada de esa
   * mesa. El correo de soporte del local se configura en sus ajustes; si no lo tiene, se
   * mantiene el buzón global y nada cambia.
   */
  private respuestaAlLocal(form: ReservationForm): string | undefined {
    const soporte = typeof form.designConfig?.supportEmail === 'string' ? form.designConfig.supportEmail.trim() : '';
    return soporte.includes('@') ? soporte : undefined;
  }

  private calendarIcs(form: ReservationForm, booking: Reservation, method: 'PUBLISH' | 'CANCEL', cancellationReason?: string): string {
    const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const configuredAddress = typeof form.designConfig?.venueAddress === 'string' ? form.designConfig.venueAddress.trim() : '';
    const description = [`Código: ${booking.referenceCode}`, `Personas: ${booking.partySize}`, ...(configuredAddress ? [`Dirección: ${configuredAddress}`] : []), ...(method === 'CANCEL' && cancellationReason ? [`Motivo de cancelación: ${cancellationReason}`] : [])].join('\n');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', `METHOD:${method}`, 'PRODID:-//Espartanos//Reservas//ES', 'BEGIN:VEVENT', `UID:reservation-${booking.id}@espartanos`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(booking.startsAt)}`, `DTEND:${stamp(booking.endsAt)}`, `SUMMARY:${escape(`${form.name} · Reserva`)}`, ...(configuredAddress ? [`LOCATION:${escape(configuredAddress)}`] : []), `DESCRIPTION:${escape(description)}`, `STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
  }

  private async sendCalendarUpdate(booking: Reservation, method: 'CANCELLED' | 'PUBLISH', cancellationReason?: string): Promise<void> {
    try {
      if (!booking.guestEmail) return;
      const form = await this.forms.findOne({ where: { id: booking.formId } });
      if (!form) return;
      const cancelled = method === 'CANCELLED';
      const reason = cancellationReason?.trim();
      const plantilla = await this.plantillaDeAviso(form, cancelled ? 'email.reservation_cancellation' : 'email.reservation_change');
      if (!plantilla.encendido) return;
      const { subject, html } = componerCorreo(plantilla.asunto, plantilla.cuerpo, {
        nombre: booking.guestName,
        local: form.name,
        // La fecha en la zona del local, no la del servidor.
        fecha: booking.startsAt.toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short', timeZone: form.timezone }),
        personas: booking.partySize,
        codigo: booking.referenceCode,
        motivo: cancelled && reason ? `Motivo: ${reason}` : '',
      });
      void this.emails.send(booking.guestEmail, subject, html, { replyTo: this.respuestaAlLocal(form), attachments: [{ filename: cancelled ? 'reserva-cancelada.ics' : 'reserva-actualizada.ics', content: this.calendarIcs(form, booking, cancelled ? 'CANCEL' : 'PUBLISH', reason), contentType: `text/calendar; charset=utf-8; method=${cancelled ? 'CANCEL' : 'PUBLISH'}` }] })
        .catch((err) => this.logger.warn(`No se pudo enviar la actualización de calendario: ${err instanceof Error ? err.message : err}`));
    } catch (err) {
      this.logger.warn(`No se pudo componer el aviso de cambio de ${booking.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  async reschedulePublicManagement(token: string, requestedStartsAt: string, requestedPartySize?: number) {
    const { record, reservation } = await this.managementReservation(token);
    if (!ACTIVE_STATUSES.includes(reservation.status)) throw new ConflictException('Esta reserva ya no se puede reagendar');
    const startsAt = new Date(requestedStartsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Fecha inválida');
    const saved = await this.transaction('reagendar reserva pública', async (manager) => {
      const booking = await manager.getRepository(Reservation).createQueryBuilder('r').setLock('pessimistic_write').where('r.id = :id', { id: reservation.id }).getOne();
      if (!booking || !ACTIVE_STATUSES.includes(booking.status)) throw new ConflictException('Esta reserva ya no se puede reagendar');
      const form = await manager.getRepository(ReservationForm).findOne({ where: { id: booking.formId } });
      if (!form || form.status !== 'published') throw new ConflictException('La agenda ya no está disponible');
      this.assertPublicBookingOpen(form);
      await this.lockClientDay(manager, form.clientId, this.localDateKey(startsAt, form.timezone));
      // Cambiar cuantos vienen se valida igual que la hora: contra el cupo, excluyendo la propia
      // reserva. Un grupo grande pasa por el equipo, asi que desde el enlace no se puede cruzar.
      const personas = requestedPartySize ?? booking.partySize;
      if (personas > this.groupThreshold(form)) throw new BadRequestException(`Para más de ${this.groupThreshold(form)} personas escribe al local: los grupos grandes se coordinan con el equipo`);
      const availability = await this.availability(manager, form, startsAt, personas, booking.serviceId, booking.resourceId, booking.id);
      const previous = booking.status;
      const previousStartsAt = booking.startsAt;
      const previousPartySize = booking.partySize;
      booking.partySize = personas;
      booking.startsAt = startsAt;
      booking.endsAt = availability.endsAt;
      booking.status = 'rescheduled';
      await manager.save(booking);
      await manager.save(ReservationEvent, manager.create(ReservationEvent, { organizationId: booking.organizationId, clientId: booking.clientId, reservationId: booking.id, type: 'rescheduled', fromStatus: previous, toStatus: booking.status, actorType: 'guest', metadata: { via: 'management_link', previousStartsAt: previousStartsAt.toISOString(), startsAt: startsAt.toISOString(), previousPartySize, partySize: personas } }));
      return booking;
    });
    record.usedAt = new Date();
    // Reagendar mueve la reserva, y el enlace debe seguir sirviendo hasta despues de la nueva
    // fecha: sin esto, mover una reserva lejos la dejaba sin forma de gestionarse.
    record.expiresAt = new Date(saved.endsAt.getTime() + GESTION_TRAS_LA_VISITA_DIAS * 86400000);
    await this.managementTokens.save(record);
    void this.sendCalendarUpdate(saved, 'PUBLISH');
    return { referenceCode: saved.referenceCode, startsAt: saved.startsAt, endsAt: saved.endsAt, status: saved.status };
  }

  /** Conserva un cupo por diez minutos mientras la persona termina el formulario. */
  async holdPublic(slug: string, dto: PublicReservationHoldDto) {
    // Retener cupo aparta inventario real, asi que exige las mismas senales que el alta.
    if (dto.website) throw new BadRequestException('Solicitud inválida');
    if (dto.renderedAt && Date.now() - new Date(dto.renderedAt).getTime() < 800) throw new BadRequestException('Completa el formulario antes de enviarlo');
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Fecha inválida');
    return this.transaction('retener cupo público', async (manager) => {
      const form = await this.publishedForm(slug, manager);
      this.assertPublicBookingOpen(form);
      await this.lockClientDay(manager, form.clientId, this.localDateKey(startsAt, form.timezone));
      const partySize = dto.partySize || 1;
      const availability = await this.availability(manager, form, startsAt, partySize, dto.serviceId, dto.resourceId, undefined, dto.holdKey);
      const repo = manager.getRepository(ReservationHold);
      const current = await repo.findOne({ where: { formId: form.id, holdKey: dto.holdKey } });
      const configuredMinutes = Number((form.designConfig as DesignConfig).holdMinutes);
      const holdMinutes = Number.isInteger(configuredMinutes) && configuredMinutes >= 1 && configuredMinutes <= 30 ? configuredMinutes : 10;
      const expiresAt = new Date(Date.now() + holdMinutes * 60_000);
      const hold = current || repo.create({ formId: form.id, holdKey: dto.holdKey, startsAt, endsAt: availability.endsAt, partySize, serviceId: dto.serviceId, resourceId: dto.resourceId, expiresAt });
      hold.startsAt = startsAt; hold.endsAt = availability.endsAt; hold.partySize = partySize; hold.serviceId = dto.serviceId; hold.resourceId = dto.resourceId; hold.expiresAt = expiresAt;
      await repo.save(hold);
      return { expiresAt: hold.expiresAt, available: availability.available };
    });
  }

  async createPublicGroupRequest(slug: string, dto: PublicGroupRequestDto) {
    if (dto.website) throw new BadRequestException('Solicitud inválida');
    if (dto.renderedAt && Date.now() - new Date(dto.renderedAt).getTime() < 800) throw new BadRequestException('Completa el formulario antes de enviarlo');
    if (!dto.reservationConsent) throw new BadRequestException('Debes aceptar las condiciones para enviar la solicitud');
    if (!dto.guestEmail?.trim() && !dto.guestPhone?.trim()) throw new BadRequestException('Indica un correo o teléfono para responderte');
    this.validateEmailDomain(dto.guestEmail);
    const form = await this.publishedForm(slug);
    const consent = this.consentTexts(form);
    const existing = await this.groupRequests.findOne({ where: { formId: form.id, idempotencyKey: dto.idempotencyKey } });
    if (existing) return { id: existing.id, status: existing.status, kind: 'group_request' };
    const request = await this.groupRequests.save(this.groupRequests.create({
      organizationId: form.organizationId, clientId: form.clientId, formId: form.id, idempotencyKey: dto.idempotencyKey,
      guestName: dto.guestName.trim(), guestEmail: dto.guestEmail?.trim().toLowerCase() || null, guestPhone: normalizePhone(dto.guestPhone) || null,
      partySize: dto.partySize, eventType: dto.eventType, preferredDate: dto.preferredDate || null, preferredTime: dto.preferredTime?.trim() || null,
      notes: dto.notes?.trim() || null, details: dto.details ?? null, reservationConsentAt: new Date(), reservationConsentText: consent.reservation,
      marketingConsentAt: dto.marketingConsent ? new Date() : null, marketingConsentText: dto.marketingConsent ? consent.marketing : null,
      utmSource: dto.utmSource || null, utmMedium: dto.utmMedium || null, utmCampaign: dto.utmCampaign || null, utmContent: dto.utmContent || null, status: 'pending',
    }));
    // Es una solicitud, no una conversión de reserva: no toma cupo ni dispara Schedule.
    void this.avisarSolicitudSinCupo(form, 'grupo', { id: request.id, guestName: request.guestName, guestEmail: request.guestEmail, partySize: request.partySize, cuando: [request.preferredDate || 'fecha por acordar', request.preferredTime].filter(Boolean).join(' ') });
    return { id: request.id, status: request.status, kind: 'group_request' };
  }

  /** Lista de espera no toma cupo: conservar la solicitud no puede volver a sobrecargar el turno. */
  async joinPublicWaitlist(slug: string, dto: PublicReservationDto) {
    if (dto.website) throw new BadRequestException('Solicitud inválida');
    if (!dto.reservationConsent) throw new BadRequestException('Debes aceptar las condiciones para unirte a la lista de espera');
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Fecha inválida');
    return this.transaction('crear espera pública', async (manager) => {
      const form = await this.publishedForm(slug, manager);
      this.assertPublicBookingOpen(form);
      const existing = await manager.getRepository(Reservation).findOne({ where: { formId: form.id, idempotencyKey: dto.idempotencyKey } });
      if (existing) return existing;
      const rules = this.assertScheduled(form, startsAt, dto.serviceId, dto.resourceId);
      this.validateSubmission(form, dto.answers, dto);
      const consent = this.consentTexts(form);
      const item = await manager.save(Reservation, manager.create(Reservation, {
        organizationId: form.organizationId, clientId: form.clientId, formId: form.id,
        idempotencyKey: dto.idempotencyKey, referenceCode: randomBytes(6).toString('hex').toUpperCase(),
        status: 'waitlist', startsAt, endsAt: new Date(startsAt.getTime() + rules.duration * 60_000), partySize: dto.partySize || 1,
        guestName: dto.guestName.trim(), guestEmail: dto.guestEmail?.trim().toLowerCase(), guestPhone: normalizePhone(dto.guestPhone),
        serviceId: dto.serviceId, resourceId: dto.resourceId, answers: dto.answers,
        consentVersion: dto.consentVersion, reservationConsentAt: new Date(), reservationConsentText: consent.reservation,
        marketingConsentAt: dto.marketingConsent ? new Date() : null, marketingConsentVersion: dto.marketingConsent ? dto.marketingConsentVersion || null : null,
        marketingConsentText: dto.marketingConsent ? consent.marketing : null, measurementConsentAt: dto.measurementConsent ? new Date() : null,
        utmSource: dto.utmSource, utmMedium: dto.utmMedium, utmCampaign: dto.utmCampaign, utmContent: dto.utmContent,
      }));
      await manager.save(ReservationEvent, manager.create(ReservationEvent, { organizationId: form.organizationId, clientId: form.clientId, reservationId: item.id, type: 'waitlist_joined', toStatus: 'waitlist', actorType: 'guest', metadata: { startsAt: startsAt.toISOString() } }));
      void this.avisarSolicitudSinCupo(form, 'espera', { id: item.id, guestName: item.guestName, guestEmail: item.guestEmail, partySize: item.partySize, cuando: startsAt.toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short', timeZone: form.timezone }) });
      return item;
    });
  }

  /**
   * Solicitudes de grupo de toda la empresa, sin exigir elegir un local primero.
   *
   * La vista por local sigue existiendo para la agenda del dia. Esta es la que responde a
   * "que solicitudes tengo pendientes" cuando quien mira no sabe todavia de que local vienen.
   */
  async listAllGroupRequests(organizationId: string, clientId?: string, clientIds?: string[], formId?: string) {
    return this.groupRequests.find({
      where: { ...this.scope(organizationId, clientId, clientIds), ...(formId ? { formId } : {}) },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async listGroupRequests(organizationId: string, formId: string, clientId?: string, clientIds?: string[]) {
    await this.getForm(organizationId, formId, clientId, clientIds);
    return this.groupRequests.find({ where: { organizationId, formId }, order: { createdAt: 'DESC' }, take: 50 });
  }
  /**
   * Convierte una solicitud de grupo en una reserva real, con la fecha que se acordó.
   *
   * El equipo tenía que volver a escribir a mano nombre, contacto, cantidad y todo lo que la
   * persona había contestado. Ahora solo pone fecha y lugar: el resto sale de la solicitud, y la
   * reserva pasa por las mismas reglas que una manual —cupo, bloqueos, comprobante—.
   */
  async convertGroupRequest(organizationId: string, id: string, dto: { startsAt: string; resourceId?: string; serviceId?: string }, actorId: string, clientId?: string, clientIds?: string[]) {
    const request = await this.groupRequests.findOne({ where: { id, ...this.scope(organizationId, clientId, clientIds) } });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.status === 'converted') throw new ConflictException('Esta solicitud ya se convirtió en reserva');
    const details = (request.details || {}) as Record<string, unknown>;
    const texto = (valor: unknown) => (typeof valor === 'string' && valor.trim() ? valor.trim() : undefined);
    const answers: Record<string, unknown> = {
      ...((details.answers as Record<string, unknown> | undefined) || {}),
      groupEventType: request.eventType,
      ...(request.notes ? { groupEventNotes: request.notes } : {}),
      ...(details.childrenCount ? { childrenCount: details.childrenCount } : {}),
      ...(texto(details.accessibilityNeed) ? { accessibilityNeed: texto(details.accessibilityNeed) } : {}),
      ...(texto(details.dietaryNotes) ? { dietaryNotes: texto(details.dietaryNotes) } : {}),
    };
    const booking = await this.createManual(organizationId, actorId, {
      formId: request.formId,
      startsAt: dto.startsAt,
      guestName: request.guestName,
      guestEmail: request.guestEmail || undefined,
      guestPhone: request.guestPhone || undefined,
      partySize: request.partySize,
      resourceId: dto.resourceId || texto(details.resourceId),
      serviceId: dto.serviceId || texto(details.serviceId),
      answers,
      internalNotes: 'Creada desde una solicitud de grupo.',
    }, clientId, clientIds);
    const reservationId = (booking as { id?: string; booking?: { id?: string } }).id ?? (booking as { booking?: { id?: string } }).booking?.id;
    request.status = 'converted';
    request.details = { ...details, reservationId };
    await this.groupRequests.save(request);
    await this.audit.log({ organizationId, actorId, entityType: 'ReservationGroupRequest', entityId: id, action: 'converted', after: { reservationId, startsAt: dto.startsAt } });
    return booking;
  }

  async updateGroupRequest(organizationId: string, id: string, dto: { status: string; quoteAmount?: number; quoteMessage?: string; quoteExpiresAt?: string }, actorId: string, clientId?: string, clientIds?: string[]) {
    const item = await this.groupRequests.findOne({ where: { id, ...this.scope(organizationId, clientId, clientIds) } });
    if (!item) throw new NotFoundException('Solicitud no encontrada');
    if (dto.status === 'quoted' && (dto.quoteAmount === undefined || !dto.quoteMessage?.trim())) throw new BadRequestException('Una cotización necesita monto y mensaje para el cliente');
    item.status = dto.status;
    if (dto.quoteAmount !== undefined) item.quoteAmount = String(dto.quoteAmount);
    if (dto.quoteMessage !== undefined) item.quoteMessage = dto.quoteMessage.trim() || null;
    if (dto.quoteExpiresAt !== undefined) item.quoteExpiresAt = new Date(dto.quoteExpiresAt);
    const saved = await this.groupRequests.save(item);
    await this.audit.log({ organizationId, actorId, entityType: 'ReservationGroupRequest', entityId: id, action: 'status_changed', after: { status: dto.status, quoteAmount: dto.quoteAmount, quoteExpiresAt: dto.quoteExpiresAt } });
    return saved;
  }

  async createPublic(slug: string, dto: PublicReservationDto, ipAddress?: string, userAgent?: string, eventSourceUrl?: string) {
    if (dto.website) throw new BadRequestException('Solicitud inválida');
    if (dto.renderedAt && Date.now() - new Date(dto.renderedAt).getTime() < 800) throw new BadRequestException('Completa el formulario antes de enviarlo');
    this.validateEmailDomain(dto.guestEmail);

    const result = await this.transaction('crear reserva publica', async (manager) => {
      // El formulario se lee sin bloquear: lo que hay que serializar no es el formulario sino el
      // día del cliente, y para saber cuál es hace falta primero su zona horaria.
      const form = await this.publishedForm(slug, manager);
      const consent = this.consentTexts(form);
      const existingIdempotent = await manager.getRepository(Reservation).findOne({ where: { formId: form.id, idempotencyKey: dto.idempotencyKey } });
      if (existingIdempotent) return { booking: existingIdempotent, form, created: false };
      // Se comprueba despues de la idempotencia: reenviar una reserva ya creada devuelve la
      // que existe, mientras que una reserva nueva no entra mientras la agenda este pausada.
      this.assertPublicBookingOpen(form);

      const startsAt = new Date(dto.startsAt);
      if (!Number.isNaN(startsAt.getTime())) {
        // Desde acá y hasta cerrar la transacción, ninguna otra reserva de este cliente para
        // este día avanza. Las de otros días y las de otros clientes no se ven afectadas.
        await this.lockClientDay(manager, form.clientId, this.localDateKey(startsAt, form.timezone));
      }
      if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Fecha inválida');
      const partySize = dto.partySize || 1;
      const availability = await this.availability(manager, form, startsAt, partySize, dto.serviceId, dto.resourceId, undefined, dto.idempotencyKey);
      this.validateSubmission(form, dto.answers, dto);

      const coupon = await this.validateCoupon(dto.couponCode, form, manager, startsAt);
      if (coupon) {
        coupon.usageCount += 1;
        await manager.save(ReservationCoupon, coupon);
      }

      // Los grupos grandes siempre pasan por el equipo: aunque exista cupo físico, un evento
      // puede requerir menú, montaje o confirmación especial.
      const status = form.confirmationMode === 'manual' || partySize > this.groupThreshold(form) ? 'pending' : 'confirmed';
      const booking = await manager.save(Reservation, manager.create(Reservation, {
        organizationId: form.organizationId,
        clientId: form.clientId,
        formId: form.id,
        idempotencyKey: dto.idempotencyKey,
        referenceCode: randomBytes(6).toString('hex').toUpperCase(),
        status,
        startsAt,
        endsAt: availability.endsAt,
        partySize,
        guestName: dto.guestName.trim(),
        guestEmail: dto.guestEmail?.trim().toLowerCase(),
        guestPhone: normalizePhone(dto.guestPhone),
        serviceId: dto.serviceId,
        resourceId: dto.resourceId,
        answers: {
          ...dto.answers,
          ...(dto.partySize && dto.partySize > this.groupThreshold(form) ? { groupEventType: dto.groupEventType || 'otro', groupEventNotes: dto.groupEventNotes?.trim() || null } : {}),
          ...(dto.childrenCount ? { childrenCount: dto.childrenCount } : {}),
          ...(dto.accessibilityNeed?.trim() ? { accessibilityNeed: dto.accessibilityNeed.trim() } : {}),
          ...(dto.dietaryNotes?.trim() ? { dietaryNotes: dto.dietaryNotes.trim() } : {}),
        },
        consentVersion: dto.consentVersion,
        reservationConsentAt: dto.reservationConsent ? new Date() : null,
        reservationConsentText: dto.reservationConsent ? consent.reservation : null,
        marketingConsentAt: dto.marketingConsent ? new Date() : null,
        marketingConsentVersion: dto.marketingConsent ? dto.marketingConsentVersion || null : null,
        marketingConsentText: dto.marketingConsent ? consent.marketing : null,
        measurementConsentAt: dto.measurementConsent ? new Date() : null,
        // La casilla llega como booleano y se guarda con su instante, que es lo que se puede
        // mostrar. Sin marcar no se inventa una fecha: queda como «no consta», que es la verdad.
        adultDeclaredAt: dto.adultDeclared ? new Date() : null,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        utmContent: dto.utmContent,
        clickId: dto.clickId,
        // El formulario en caché todavía manda `clickId`; se interpreta como `gclid` porque
        // ese era su destino real. Un `gclid` explícito manda sobre él.
        gclid: dto.gclid ?? dto.clickId,
        gbraid: dto.gbraid,
        wbraid: dto.wbraid,
        fbclid: dto.fbclid,
        fbc: dto.fbc,
        fbp: dto.fbp,
        clientIpAddress: ipAddress,
        clientUserAgent: userAgent,
        couponCode: coupon?.code,
      }));

      await manager.save(ReservationEvent, manager.create(ReservationEvent, {
        organizationId: form.organizationId,
        clientId: form.clientId,
        reservationId: booking.id,
        type: 'created',
        toStatus: status,
        actorType: 'guest',
        metadata: { startsAt: startsAt.toISOString(), serviceId: dto.serviceId, resourceId: dto.resourceId },
      }));

      await manager.getRepository(ReservationHold).delete({ formId: form.id, holdKey: dto.idempotencyKey });

      const managementToken = await this.createManagementToken(booking.id, booking.endsAt, manager);
      return { booking, form, created: true, managementToken };
    }).catch(async (error) => {
      // Dos envios simultaneos con la misma clave pasan juntos la comprobacion previa y el
      // indice unico rechaza al segundo. La reserva quedo creada, asi que se devuelve esa y no
      // un error. Se resuelve fuera de la transaccion para que su reversion deshaga tambien el
      // consumo del cupon.
      if ((error as { code?: string })?.code !== 'ER_DUP_ENTRY' || !dto.idempotencyKey) throw error;
      const form = await this.publishedForm(slug);
      const booking = await this.reservations.findOne({ where: { formId: form.id, idempotencyKey: dto.idempotencyKey } });
      if (!booking) throw error;
      return { booking, form, created: false, managementToken: undefined };
    });

    /*
     * Desde acá el bloqueo del formulario ya está liberado, y todo lo que sigue debe quedarse
     * afuera.
     *
     * La transacción de arriba toma un bloqueo sobre la fila del formulario para impedir el
     * sobrecupo: mientras dura, **ninguna otra reserva de ese formulario avanza**. Por eso
     * adentro solo hay lecturas y escrituras de base, que tardan milisegundos.
     *
     * Meta y Google no llaman a nadie desde acá: `enqueue` solo escribe en su bandeja de salida
     * y un trabajo aparte hace el envío. Esa bandeja es lo que impide que una caída de Facebook
     * afecte a quien reserva, y es protección estructural, no una convención que respetar.
     *
     * **El correo sí sale a la red en el acto** — `sendMail` abre una conexión SMTP y espera
     * respuesta. Es la única operación de este bloque que puede tardar segundos o agotar su
     * tiempo de espera, y por eso importa que esté acá afuera: adentro dejaría el formulario
     * bloqueado mientras un servidor de correo ajeno decide contestar.
     *
     * Si hay que agregar un efecto nuevo al crear una reserva, va acá abajo. Y si ese efecto
     * habla con un tercero, lo correcto es darle su propia bandeja de salida en vez de
     * llamarlo directo, como ya se hizo con Meta y con Google.
     */
    const capabilities = await this.clientCapabilities(result.form.organizationId, result.form.clientId);

    // Reservas no crea ni modifica registros CRM. Las reservas y los contactos históricos
    // permanecen intactos, pero las nuevas operaciones ya no cruzan módulos.

    if (result.created && result.form.calendarEnabled) {
      // Sin esperar: crear el evento es una llamada HTTP a Google de varios cientos de
      // milisegundos, y mientras dura ocupa uno de los procesos entrantes de la cuenta sin
      // hacer nada. Lo que no llegue a crearse acá lo recoge
      // `RecoverReservationIntegrationsJob`, que encuentra las reservas por su
      // `calendar_event_id` vacío.
      const { form, booking } = result;
      void this.calendar.createEvent(form.organizationId, {
        summary: `${form.name}: ${booking.guestName}`,
        description: `Reserva ${booking.referenceCode}`,
        start: booking.startsAt,
        durationMinutes: Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60000),
      })
        .then((event) => this.reservations.update(booking.id, { calendarEventId: event.externalId, calendarUrl: event.calendarUrl }))
        .catch((err) => this.logger.warn(`Evento de calendario pendiente para la reserva ${booking.id}: ${err instanceof Error ? err.message : err}`));
    }

    if (result.created && result.booking.measurementConsentAt && result.form.metaCapiEnabled && capabilities.metaConversions) {
      try {
        await this.enqueueMetaConversion(result.booking, result.form, META_DEDUPLICATED_EVENTS.SCHEDULE, Math.floor(result.booking.createdAt.getTime() / 1000), eventSourceUrl);
      } catch (err) {
        this.logger.warn(`Meta CAPI enqueue failed for booking ${result.booking.id}: ${err instanceof Error ? err.message : err}`);
        await this.recordIntegrationFailure(result.booking, 'meta_capi');
      }
    }

    if (result.created && result.booking.measurementConsentAt) {
      try {
        await this.enqueueGoogleConversion(result.booking, result.form, 'schedule', result.booking.createdAt);
      } catch (err) {
        this.logger.warn(`Google Ads enqueue failed for booking ${result.booking.id}: ${err instanceof Error ? err.message : err}`);
        await this.recordIntegrationFailure(result.booking, 'google_ads');
      }
    }

    const managementToken = result.created ? result.managementToken : undefined;
    if (result.created) await this.notifyNewBooking(result.form, result.booking, managementToken);
    return { ...result.booking, managementToken };
  }

  private async recordIntegrationFailure(booking: Reservation, provider: string) {
    await this.events.save(this.events.create({
      organizationId: booking.organizationId,
      clientId: booking.clientId,
      reservationId: booking.id,
      type: 'integration_failed',
      actorType: 'system',
      metadata: { provider },
    }));
  }

  /**
   * Encola la conversión equivalente hacia Google Ads.
   *
   * Se omite en silencio si el cliente no tiene Ads conectado o no configuró
   * la acción de conversión: la reserva no debe fallar por eso. El gclid viene
   * de `clickId`, capturado desde la URL del anuncio; si no hay, Google puede
   * atribuir igual vía enhanced conversions con los datos hasheados.
   */
  private async enqueueGoogleConversion(booking: Reservation, form: ReservationForm, eventKey: string, conversionDate: Date) {
    if (!this.googleOutbox) return;
    // Enviar datos personales a Google requiere habilitación explícita por
    // empresa, igual que metaConversions.
    const capabilities = await this.clientCapabilities(form.organizationId, form.clientId);
    if (!capabilities.googleConversions) return;

    const config = await this.googleOutbox.resolveConfig(form.organizationId, form.clientId, eventKey);
    if (!config) return;

    const [firstName, ...lastNameParts] = (booking.guestName ?? '').trim().split(/\s+/);
    const location = inferLocationFromPhone(booking.guestPhone);

    await this.googleOutbox.enqueue(form.organizationId, config, `${eventKey}:${booking.id}`, {
      // Solo identificadores de Google. `fbclid` viaja por su propio campo hacia Meta: subirlo
      // acá como `gclid` hacía que Google descartara la fila dentro de `partialFailureError`,
      // y de paso impedía caer al camino de conversiones mejoradas, que sí habría atribuido.
      gclid: booking.gclid ?? undefined,
      gbraid: booking.gbraid ?? undefined,
      wbraid: booking.wbraid ?? undefined,
      orderId: booking.id,
      conversionDateTime: conversionDate,
      timezone: form.timezone,
      userData: {
        email: booking.guestEmail ?? undefined,
        phone: booking.guestPhone ?? undefined,
        firstName: firstName || undefined,
        lastName: lastNameParts.join(' ') || undefined,
        country: location.country,
        region: location.region,
        city: location.city,
      },
    });
  }

  private async enqueueMetaConversion(booking: Reservation, form: ReservationForm, eventName: string, eventTime?: number, eventSourceUrl?: string) {
    const { pixelId, accessToken } = await this.getClientMetaConfig(form.clientId, form.organizationId, form);
    if (!pixelId || !accessToken) throw new Error('Meta pixel or CAPI token is not configured');
    // 'Schedule' se dispara desde el formulario web público (action_source: website, requiere event_source_url).
    // La asistencia la confirma el staff en persona, así que debe reportarse como physical_store
    // (la ventana de 7 días para subir eventos 'website'/'system_generated' de Meta es muy ajustada
    // para ese flujo; physical_store tiene 62 días) y event_source_url no aplica.
    const isWebEvent = eventName === 'Schedule';
    const actionSource = isWebEvent ? 'website' : 'physical_store';
    const fallbackUrl = process.env.APP_PUBLIC_URL ? `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/book/${encodeURIComponent(form.publicSlug)}` : undefined;
    eventSourceUrl = isWebEvent ? (eventSourceUrl || fallbackUrl || undefined) : undefined;
    const [firstName, ...lastNameParts] = (booking.guestName ?? '').trim().split(/\s+/);
    const lastName = lastNameParts.join(' ');
    // Ubicación aproximada derivada del teléfono (sin proveedor externo): sube
    // el Match Quality de Meta al aportar country/ct/st, que Meta no puede
    // deducir por sí solo del client_ip_address.
    const location = inferLocationFromPhone(booking.guestPhone);
    await this.metaOutbox.enqueue(form.organizationId, pixelId, {
      eventName, eventTime: eventTime ?? Math.floor(Date.now() / 1000), actionSource, eventSourceUrl,
      userData: {
        em: booking.guestEmail ? [booking.guestEmail] : undefined,
        ph: booking.guestPhone ? [booking.guestPhone] : undefined,
        fn: firstName ? [firstName] : undefined,
        ln: lastName ? [lastName] : undefined,
        externalId: [booking.id],
        ct: location.city ? [location.city] : undefined,
        st: location.region ? [location.region] : undefined,
        country: location.country ? [location.country] : undefined,
        fbc: booking.fbc ?? undefined,
        fbp: booking.fbp ?? undefined,
        client_ip_address: booking.clientIpAddress ?? undefined,
        client_user_agent: booking.clientUserAgent ?? undefined,
      },
      customData: { contentIds: [form.id], contentType: 'reservation' },
      // El identificador sale de la función compartida con el navegador: si los dos lados no
      // coinciden, Meta cuenta dos conversiones donde hubo una y nadie se entera.
      eventId: metaEventId(eventName as MetaEvent, booking.id),
    }, form.clientId);
  }

  private async enqueueMetaSurveyConversion(response: ReservationFormEvent, form: ReservationForm, dto: PublicSurveyResponseDto, ipAddress?: string, userAgent?: string, eventSourceUrl?: string) {
    const { pixelId, accessToken } = await this.getClientMetaConfig(form.clientId, form.organizationId, form);
    if (!pixelId || !accessToken) throw new Error('Meta pixel or CAPI token is not configured');
    const fallbackUrl = process.env.APP_PUBLIC_URL ? `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/book/${encodeURIComponent(form.publicSlug)}` : undefined;
    const [firstName, ...lastNameParts] = (dto.guestName ?? '').trim().split(/\s+/);
    const lastName = lastNameParts.join(' ');
    const phone = dto.guestPhone?.replace(/[^\d+]/g, '');
    const location = inferLocationFromPhone(phone);

    await this.metaOutbox.enqueue(form.organizationId, pixelId, {
      eventName: META_DEDUPLICATED_EVENTS.LEAD,
      eventTime: Math.floor(response.createdAt.getTime() / 1000),
      actionSource: 'website',
      eventSourceUrl: eventSourceUrl || fallbackUrl || undefined,
      userData: {
        em: dto.guestEmail ? [dto.guestEmail] : undefined,
        ph: phone ? [phone] : undefined,
        fn: firstName ? [firstName] : undefined,
        ln: lastName ? [lastName] : undefined,
        externalId: [response.id],
        ct: location.city ? [location.city] : undefined,
        st: location.region ? [location.region] : undefined,
        country: location.country ? [location.country] : undefined,
        fbc: dto.fbc ?? undefined,
        fbp: dto.fbp ?? undefined,
        client_ip_address: ipAddress ?? undefined,
        client_user_agent: userAgent ?? undefined,
      },
      /*
       * La nota de la encuesta no viaja.
       *
       * `value` es, para Meta, el importe económico de la conversión, y una puntuación de
       * satisfacción no lo es: aparece en sus informes como si cada respuesta hubiera producido
       * ingresos de 4 o 5, y de paso entrega a un tercero una respuesta que la persona dio para
       * nosotros. La nota sigue guardada en la respuesta del formulario, que es donde sirve.
       */
      customData: { contentIds: [form.id], contentType: 'survey' },
      eventId: metaEventId(META_DEDUPLICATED_EVENTS.LEAD, response.id),
    }, form.clientId);
  }


  /**
   * El comprobante para quien reservó.
   *
   * Hasta ahora solo se avisaba al equipo: la persona que reservaba **no recibía nada**, así que
   * se quedaba sin fecha, sin código y sin nada que enseñar al llegar. Es el correo que más
   * falta hacía de todo el sistema.
   *
   * El asunto nombra el local aunque el remitente sea el de la agencia: quien reservó no conoce
   * a Espartanos, y una confirmación de un desconocido acaba en spam.
   *
   * La plantilla se resuelve **por empresa** y cae a la general si esa empresa no tiene la suya.
   *
   * Nunca revierte la reserva: si el correo falla, la reserva ya está confirmada y perderla por
   * un servidor de correo caído sería mucho peor que un comprobante que no llegó.
   */
  private async enviarComprobante(form: ReservationForm, booking: Reservation, managementToken?: string): Promise<void> {
    try {
      if (!booking.guestEmail) return;

      const encendido = await this.parametros.get(
        'email.reservation_confirmation_enabled', form.clientId, null, form.organizationId,
      );
      if (!encendido) return;

      const [asunto, cuerpo] = await Promise.all([
        this.parametros.get('email.reservation_confirmation_subject', form.clientId, null, form.organizationId),
        this.parametros.get('email.reservation_confirmation_body', form.clientId, null, form.organizationId),
      ]);

      const managementUrl = managementToken && process.env.APP_PUBLIC_URL
        ? `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/book/manage/${managementToken}` : undefined;

      /*
       * Una reserva pendiente no está confirmada, y el comprobante no puede decir que sí.
       *
       * En modo de revisión manual —y en cualquier grupo grande— la reserva nace `pending`. La
       * pantalla pública lo dice bien: «aún no está confirmada». El correo usaba igualmente la
       * plantilla de confirmación, así que la persona leía que tenía mesa asegurada y el local
       * se encontraba con alguien que llegaba sin cupo. Este texto no es configurable a
       * propósito: la plantilla de la empresa afirma una confirmación que todavía no ocurrió.
       */
      const pendiente = booking.status === 'pending';
      const plantilla = pendiente
        ? {
          asunto: 'Recibimos tu solicitud en {{local}}',
          cuerpo: 'Hola {{nombre}}:\n\nRecibimos tu solicitud para el {{fecha}} en {{local}}. Todavía no está confirmada: el local la revisará y te avisará por este mismo medio.\n\nPersonas: {{personas}}\nCódigo: {{codigo}}',
        }
        : {
          asunto: String(asunto ?? 'Tu reserva en {{local}} está confirmada'),
          cuerpo: String(cuerpo ?? 'Tu reserva quedó confirmada para el {{fecha}}.'),
        };

      const { subject, html } = componerCorreo(
        plantilla.asunto,
        plantilla.cuerpo,
        {
          nombre: booking.guestName,
          local: form.name,
          fecha: booking.startsAt.toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short', timeZone: form.timezone }),
          personas: booking.partySize,
          codigo: booking.referenceCode,
          gestion: managementUrl || '',
        },
        managementUrl ? { texto: pendiente ? 'Ver o cancelar mi solicitud' : 'Gestionar mi reserva', url: managementUrl } : undefined,
      );

      /*
       * Sin esperar, igual que el aviso al equipo.
       *
       * El envío es un saludo TLS más una entrega, y con el servidor de correo lento eso se
       * sumaba entero a lo que espera quien está reservando en la página.
       *
       * Una reserva pendiente no lleva `.ics`: guardar en el calendario una cita que el local
       * todavía puede rechazar deja un recordatorio de algo que nunca existió.
       */
      void this.emails.send(booking.guestEmail, subject, html, pendiente ? { replyTo: this.respuestaAlLocal(form) } : { replyTo: this.respuestaAlLocal(form), attachments: [{ filename: 'reserva.ics', content: this.calendarIcs(form, booking, 'PUBLISH'), contentType: 'text/calendar; charset=utf-8; method=PUBLISH' }] }).catch((err) => this.logger.warn(
        `Comprobante de la reserva ${booking.id} no enviado: ${err instanceof Error ? err.message : err}`,
      ));
    } catch (err) {
      this.logger.warn(
        `No se pudo componer el comprobante de ${booking.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async notifyNewBooking(form: ReservationForm, booking: Reservation, managementToken?: string): Promise<void> {
    // El comprobante va aparte del aviso al equipo: son dos destinatarios con dos motivos, y
    // que falle el de dentro no puede impedir el de fuera.
    void this.enviarComprobante(form, booking, managementToken);
    try {
      const equipo = await this.equipoDelLocal(form);
      if (equipo.userIds.length) {
        await this.notifications.notifyMultiple(form.organizationId, equipo.userIds, 'reservation_created', 'Nueva reserva recibida', `${booking.guestName} reservó ${form.name} para el ${booking.startsAt.toLocaleString('es-CL', { timeZone: form.timezone })}.`, { reservationId: booking.id, formId: form.id, clientId: form.clientId, referenceCode: booking.referenceCode });
      }
      // Los correos del equipo salen aunque el local no tenga usuarios en el sistema: antes se
      // cortaba ahí y un local atendido solo por correo no se enteraba de ninguna reserva.
      if (equipo.correos.length === 0) return;
      const plantilla = await this.plantillaDeAviso(form, 'email.team_new_reservation');
      if (!plantilla.encendido) return;
      const { subject, html } = componerCorreo(plantilla.asunto, plantilla.cuerpo, {
        nombre: booking.guestName, local: form.name, personas: booking.partySize, codigo: booking.referenceCode,
        fecha: booking.startsAt.toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short', timeZone: form.timezone }),
      });
      // Sin esperar: con el servidor de correo lento eso se sumaba a lo que espera quien reserva.
      void Promise.all(equipo.correos.map((email) => this.emails.send(email, subject, html)))
        .catch((err) => this.logger.warn(`Aviso por correo de la reserva ${booking.id} no enviado: ${err instanceof Error ? err.message : err}`));
    } catch (err) {
      // Las notificaciones son útiles pero nunca deben revertir una reserva confirmada.
      this.logger.warn(`Notification failed for booking ${booking.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  async listReservations(organizationId: string, query: ListReservationsDto, clientId?: string, clientIds?: string[], includeInternalNotes = true) {
    const page = query.page ?? 1; const pageSize = query.pageSize ?? 50; const qb = this.reservations.createQueryBuilder('r').where('r.organization_id = :organizationId', { organizationId }); if (clientId) qb.andWhere('r.client_id = :clientId', { clientId }); else if (clientIds !== undefined) qb.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds }); if (query.formId) qb.andWhere('r.form_id = :formId', { formId: query.formId }); if (query.status) qb.andWhere('r.status = :status', { status: query.status }); if (query.from) qb.andWhere('r.starts_at >= :from', { from: query.from }); if (query.to) qb.andWhere('r.starts_at <= :to', { to: query.to });     if (query.search) qb.andWhere('(r.guest_name LIKE :search OR r.guest_email LIKE :search OR r.guest_phone LIKE :search OR r.reference_code LIKE :search)', { search: `%${query.search}%` }); if (query.couponCode) qb.andWhere('r.coupon_code = :couponCode', { couponCode: query.couponCode }); const [items, total] = await qb.orderBy('r.starts_at', 'DESC').skip((page - 1) * pageSize).take(pageSize).getManyAndCount(); const safeItems = includeInternalNotes ? items : items.map(({ internalNotes: _internalNotes, ...item }) => item);
    const conversions = await this.metaConversionStatus(organizationId, items);
    const withConversion = safeItems.map((item) => ({ ...item, metaConversion: conversions.get(item.id) }));
    // `data` es el nombre con que responden todas las listas del sistema. Convivió un tiempo con
    // `items`, que era el nombre anterior de este módulo; se retiró al migrar las pantallas.
    return { data: withConversion, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  }

  /**
   * Estado de las conversiones enviadas a Meta para un lote de reservas.
   *
   * El brief mide el exito del circuito en Events Manager: que el evento llegue y que
   * llegue con datos de coincidencia. Esto expone ambas cosas en la bandeja, sin tener que
   * salir a Meta para saber si una reserva quedo fuera del circuito.
   *
   * `schedule` corresponde al evento de reserva y `attended` al de asistencia, que son los
   * dos unicos eventos del alcance. `matchFields` cuenta los identificadores presentes en
   * la reserva: sin ninguno, Meta no puede atribuirla a la campana.
   */
  private async metaConversionStatus(organizationId: string, items: Reservation[]) {
    const result = new Map<string, { schedule: string | null; attended: string | null; matchFields: number }>();
    if (items.length === 0) return result;

    const eventIds = items.flatMap((item) => [
      metaEventId(META_DEDUPLICATED_EVENTS.SCHEDULE, item.id),
      metaEventId(META_SERVER_ONLY_EVENTS.RESERVA_ASISTIDA, item.id),
    ]);
    let rows: Array<{ event_id: string; status: string }> = [];
    try {
      rows = await this.dataSource.query(
        `SELECT event_id, status FROM meta_conversion_outbox WHERE organization_id = ? AND event_id IN (${eventIds.map(() => '?').join(',')})`,
        [organizationId, ...eventIds],
      );
    } catch (err) {
      // La bandeja debe abrir aunque el outbox no responda: el estado se muestra desconocido.
      this.logger.warn(`No se pudo leer el estado de conversiones Meta: ${err instanceof Error ? err.message : err}`);
      return result;
    }

    const byEvent = new Map(rows.map((row) => [row.event_id, row.status]));
    for (const item of items) {
      const matchFields = [item.guestEmail, item.guestPhone, item.fbc, item.fbp, item.clientIpAddress].filter(Boolean).length;
      result.set(item.id, {
        schedule: byEvent.get(metaEventId(META_DEDUPLICATED_EVENTS.SCHEDULE, item.id)) ?? null,
        attended: byEvent.get(metaEventId(META_SERVER_ONLY_EVENTS.RESERVA_ASISTIDA, item.id)) ?? null,
        matchFields,
      });
    }
    return result;
  }

  async updateReservation(organizationId: string, id: string, dto: UpdateReservationDto, actorId: string, actorType: string, clientId?: string, clientIds?: string[]) {
    let formForMeta: ReservationForm | undefined;
    let statusChangedTo: string | undefined;
    let calendarNotification: 'CANCELLED' | 'PUBLISH' | undefined;
    // Confirmar a mano era el unico paso del flujo del que nadie se enteraba fuera del panel.
    let confirmoUnaPendiente = false;
    let liberoCupo = false;
    const saved = await this.transaction('actualizar reserva', async (manager) => { const repo = manager.getRepository(Reservation); const qb = repo.createQueryBuilder('r').setLock('pessimistic_write').where('r.id = :id AND r.organization_id = :organizationId', { id, organizationId }); if (clientId) qb.andWhere('r.client_id = :clientId', { clientId }); else if (clientIds !== undefined) qb.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds }); const item = await qb.getOne(); if (!item) throw new NotFoundException('Reserva no encontrada'); const previousStatus = item.status; const previousStart = item.startsAt;
      if (dto.startsAt) {
        if (!['pending', 'confirmed', 'rescheduled', 'waitlist'].includes(item.status)) throw new ConflictException(`No se puede reagendar una reserva en estado ${item.status}`);
        const form = await manager.getRepository(ReservationForm).findOneByOrFail({ id: item.formId, organizationId }); const startsAt = new Date(dto.startsAt); await this.lockClientDay(manager, form.clientId, this.localDateKey(startsAt, form.timezone)); const available = await this.availability(manager, form, startsAt, item.partySize, item.serviceId, item.resourceId, item.id); item.startsAt = startsAt; item.endsAt = available.endsAt; item.status = 'rescheduled';
      }
      if (dto.status && dto.status !== item.status) {
        if (!STATUS_TRANSITIONS[item.status]?.includes(dto.status)) throw new ConflictException(`No se puede pasar de ${item.status} a ${dto.status}`);
        if (dto.status === 'cancelled_business' && !dto.cancellationReason?.trim()) throw new BadRequestException('Indica el motivo para cancelar una reserva desde el local');
        if (item.status === 'waitlist' && dto.status === 'confirmed') {
          const form = await manager.getRepository(ReservationForm).findOneByOrFail({ id: item.formId, organizationId });
          await this.availability(manager, form, item.startsAt, item.partySize, item.serviceId, item.resourceId, item.id);
        }
        if (item.status === 'pending' && dto.status === 'confirmed') confirmoUnaPendiente = true;
        if (dto.status === 'attended') {
          formForMeta = await manager.getRepository(ReservationForm).findOneByOrFail({ id: item.formId, organizationId });
        }
        statusChangedTo = dto.status;
        item.status = dto.status;
        if (dto.status === 'cancelled_business') calendarNotification = 'CANCELLED';
        if (dto.status.startsWith('cancelled')) { await this.devolverCupon(manager, item); liberoCupo = true; }
      }
      if (dto.internalNotes !== undefined) item.internalNotes = dto.internalNotes; const result = await repo.save(item); const changedStart = previousStart.getTime() !== result.startsAt.getTime(); if (changedStart) calendarNotification = 'PUBLISH'; if (previousStatus !== result.status || changedStart) await manager.save(ReservationEvent, manager.create(ReservationEvent, { organizationId, clientId: result.clientId, reservationId: result.id, type: changedStart ? 'rescheduled' : 'status_changed', fromStatus: previousStatus, toStatus: result.status, actorId, actorType, metadata: changedStart ? { from: previousStart.toISOString(), to: result.startsAt.toISOString() } : dto.cancellationReason?.trim() ? { cancellationReason: dto.cancellationReason.trim() } : undefined })); return result; });
    const capabilities = formForMeta ? await this.clientCapabilities(organizationId, formForMeta.clientId) : undefined;
    // Intencionalmente no se envía evento de Meta CAPI para 'no_show': la Conversions API no tiene
    // concepto de conversión negativa/revertida, así que no hay nada correcto que enviarle a Meta
    // por una inasistencia — enviar cualquier cosa le diría al algoritmo "esta persona convirtió",
    // que es lo opuesto de lo que pasó. 'attended' es el único resultado que produce una señal
    // de conversión real. Los resultados se mantienen exclusivamente en Reservas.
    if (statusChangedTo === 'attended' && saved.measurementConsentAt && formForMeta?.metaCapiEnabled && capabilities?.metaConversions) { try { await this.enqueueMetaConversion(saved, formForMeta, META_SERVER_ONLY_EVENTS.RESERVA_ASISTIDA, Math.floor(saved.startsAt.getTime() / 1000)); } catch (err) { this.logger.warn(`Meta CAPI attended event failed for booking ${saved.id}: ${err instanceof Error ? err.message : err}`); await this.recordIntegrationFailure(saved, 'meta_capi'); } }
    if (statusChangedTo === 'attended' && formForMeta) { try { await this.enqueueGoogleConversion(saved, formForMeta, 'attended', saved.startsAt); } catch (err) { this.logger.warn(`Google Ads attended event failed for booking ${saved.id}: ${err instanceof Error ? err.message : err}`); await this.recordIntegrationFailure(saved, 'google_ads'); } }
    /*
     * La solicitud pendiente quedo confirmada: hay que decirlo.
     *
     * Quien reservo en un local con revision manual recibia "la revisaremos" y despues nada,
     * ni cuando el local aceptaba. Se enteraba al llegar. Ahora recibe el comprobante real,
     * con su `.ics` y su enlace de gestion, en el momento en que pasa a estar confirmada.
     */
    if (confirmoUnaPendiente) {
      try {
        const form = await this.forms.findOne({ where: { id: saved.formId } });
        if (form) void this.enviarComprobante(form, saved, await this.createManagementToken(saved.id, saved.endsAt));
      } catch (err) {
        this.logger.warn(`Comprobante de confirmacion de ${saved.id} no enviado: ${err instanceof Error ? err.message : err}`);
      }
    }
    if (calendarNotification) void this.sendCalendarUpdate(saved, calendarNotification, statusChangedTo === 'cancelled_business' ? dto.cancellationReason : undefined);
    if (liberoCupo) void this.avisarCupoLiberado(saved);
    return saved;
  }

  /** Cierra un turno sin obligar al encargado a marcar una por una las asistencias. */
  async closeDayByException(organizationId: string, dto: CloseReservationDayDto, actorId: string, clientId?: string, clientIds?: string[]) {
    const form = await this.getForm(organizationId, dto.formId, clientId, clientIds);
    const start = startOfLocalDayUtc(dto.date, form.timezone);
    const end = startOfLocalDayUtc(addPlainDays(dto.date, 1), form.timezone);
    if (end > new Date()) throw new BadRequestException('Solo puedes cerrar un turno que ya terminó');
    return this.transaction('cerrar turno por excepción', async (manager) => {
      await this.lockClientDay(manager, form.clientId, dto.date);
      const bookings = await manager.getRepository(Reservation).createQueryBuilder('r').setLock('pessimistic_write')
        .where('r.form_id = :formId AND r.starts_at >= :start AND r.starts_at < :end AND r.status IN (:...statuses)', { formId: form.id, start, end, statuses: ACTIVE_STATUSES }).getMany();
      for (const booking of bookings) {
        const previous = booking.status;
        booking.status = 'attended';
        await manager.save(booking);
        await manager.save(ReservationEvent, manager.create(ReservationEvent, { organizationId, clientId: form.clientId, reservationId: booking.id, type: 'status_changed', fromStatus: previous, toStatus: 'attended', actorId, actorType: 'team', metadata: { via: 'exception_day_close', reason: dto.reason || null, automaticAttendance: true } }));
      }
      return { closed: bookings.length, date: dto.date, formId: form.id };
    });
  }
  async history(organizationId: string, reservationId: string, clientId?: string, clientIds?: string[]) { const reservation = await this.reservations.findOne({ where: { id: reservationId, ...this.scope(organizationId, clientId, clientIds) } }); if (!reservation) throw new NotFoundException('Reserva no encontrada'); return this.events.find({ where: { reservationId, organizationId }, order: { createdAt: 'DESC' } }); }
  /**
   * Resumen del día para la portada operativa: cómo viene la jornada y si la señal a Meta
   * está llegando.
   *
   * Responde en una sola llamada porque son cinco cifras que se miran juntas y a primera hora:
   * repartirlas en cinco peticiones haría que la pantalla se arme a pedazos delante de quien
   * la abre.
   *
   * El día se delimita en la zona del cliente, no en la del servidor. Con la base en UTC, un
   * "hoy" calculado a la chilena y otro a la inglesa se desfasan justo en la franja de cena.
   */
  async operationalHome(organizationId: string, clientId?: string, clientIds?: string[]) {
    const timezone = clientId ? await this.clientTimezone(clientId, organizationId) : 'America/Santiago';
    const today = this.localDateKey(new Date(), timezone);
    const from = startOfLocalDayUtc(today, timezone);
    const to = startOfLocalDayUtc(addPlainDays(today, 1), timezone);

    const scope = this.sqlClientScope(clientId, clientIds);
    const [row] = await this.dataSource.query(
      `SELECT COALESCE(SUM(party_size), 0) total,
              COALESCE(SUM(status = 'attended' AND starts_at <= NOW()), 0) attended,
              COALESCE(SUM(status = 'pending' AND starts_at > NOW()), 0) pending,
              COALESCE(SUM(status = 'no_show'), 0) noShow
       FROM reservations
       WHERE organization_id = ? AND starts_at >= ? AND starts_at < ? AND status IN ('pending','confirmed','rescheduled','attended','no_show')${scope.clause}`,
      [organizationId, from, to, ...scope.params],
    );

    const total = Number(row?.total ?? 0);
    const dailyCap = clientId ? await this.clientDailyCap(this.dataSource, clientId) : 0;

    // Solo lo que queda por delante: a media tarde, las reservas de la mañana ya no son
    // "próximas" y arrastrarlas empuja fuera de la vista lo que sí está por ocurrir.
    const now = new Date();
    const horizon = new Date(now.getTime() + 3 * 3_600_000);
    const upcomingQuery = this.reservations.createQueryBuilder('r')
      .select(['r.id', 'r.guestName', 'r.partySize', 'r.startsAt', 'r.status', 'r.clientId'])
      .where('r.organization_id = :organizationId', { organizationId })
      .andWhere("r.status NOT LIKE 'cancelled%'")
      .andWhere('r.starts_at >= :now AND r.starts_at < :horizon', { now, horizon });

    // El alcance se aplica con parámetros con nombre y no reutilizando `sqlClientScope`, que
    // devuelve marcadores posicionales para consultas en crudo y no encajan acá.
    if (clientId) upcomingQuery.andWhere('r.client_id = :clientId', { clientId });
    else if (clientIds !== undefined) {
      upcomingQuery.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds });
    }

    const upcoming = await upcomingQuery.orderBy('r.starts_at', 'ASC').take(12).getMany();

    const signal = await this.metaConversionStatus(organizationId, upcoming);

    return {
      date: today,
      timezone,
      today: {
        total,
        attended: Number(row?.attended ?? 0),
        pending: Number(row?.pending ?? 0),
        noShow: Number(row?.noShow ?? 0),
        dailyCap,
        occupancyPct: dailyCap > 0 ? Math.min(100, Math.round((total / dailyCap) * 100)) : null,
      },
      upcoming: upcoming.map((booking) => ({
        id: booking.id,
        startsAt: booking.startsAt.toISOString(),
        guestName: booking.guestName,
        partySize: booking.partySize,
        status: booking.status,
        metaConversion: signal.get(booking.id) ?? null,
      })),
    };
  }

  async metrics(organizationId: string, clientId?: string, clientIds?: string[], days = '30') {
    const scoped = this.sqlClientScope(clientId, clientIds); const params = [organizationId, ...scoped.params]; const scope = scoped.clause;
    const daysNum = Math.min(Math.max(Number(days) || 30, 1), 365);
    params.push(daysNum as never);
    const [totals, daily, sources, funnel, areas] = await Promise.all([this.dataSource.query(`SELECT COUNT(*) total, SUM(status='pending') pending, SUM(status='confirmed') confirmed, SUM(status='attended') attended, SUM(status='no_show') no_show, SUM(status='waitlist') waitlist, SUM(status LIKE 'cancelled%') cancelled FROM reservations WHERE organization_id = ?${scope} AND starts_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`, params), this.dataSource.query(`SELECT DATE(starts_at) day, COUNT(*) total, SUM(status='attended') attended, SUM(status='no_show') no_show FROM reservations WHERE organization_id = ?${scope} AND starts_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY day ORDER BY day`, params), this.dataSource.query(`SELECT COALESCE(utm_source,'direct') source, COALESCE(utm_medium,'Sin medio') medium, COALESCE(utm_campaign,'Sin campaña') campaign, COALESCE(utm_content,'') content, COUNT(*) total, SUM(status='attended') attended FROM reservations WHERE organization_id = ?${scope} AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY source,medium,campaign,content ORDER BY total DESC LIMIT 20`, params), this.dataSource.query(`SELECT SUM(type='view') views, SUM(type='start') starts FROM reservation_form_events WHERE organization_id = ?${scope} AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`, params), this.dataSource.query(`SELECT COALESCE(NULLIF(resource_id,''),'Sin área') area, COUNT(*) total FROM reservations WHERE organization_id = ?${scope} AND starts_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY area ORDER BY total DESC LIMIT 10`, params)]);
    const total = Number(totals[0]?.total || 0); const views = Number(funnel[0]?.views || 0);
    // El area llega como el id interno de la zona: quien mira el grafico reconoce «Terraza», no
    // «zona-1712...». Si la zona se borro despues, se conserva el id antes que inventar un nombre.
    const nombresDeZona = new Map<string, string>();
    for (const form of (await this.forms.find({ where: this.scope(organizationId, clientId, clientIds), select: ['id', 'resourcesConfig'] })) ?? []) {
      for (const zona of (form.resourcesConfig || []) as ResourceConfig[]) if (zona.id && zona.name) nombresDeZona.set(zona.id, zona.name);
    }
    const areasConNombre = (areas as Array<{ area: string; total: number }>).map((row) => ({ ...row, area: nombresDeZona.get(row.area) || row.area }));
    return { totals: totals[0] || {}, daily, sources, areas: areasConNombre, funnel: { views, starts: Number(funnel[0]?.starts || 0), completed: total, conversionRate: views ? Math.round(total * 1000 / views) / 10 : null }, days: daysNum };
  }

  /**
   * Ocupación diaria de un mes: reservas del día vs. el tope diario del cliente.
   *
   * El tope es por cliente (no por formulario, ver `clientDailyCap`), así que el porcentaje
   * es el mismo sin importar qué formulario haya generado la reserva.
   */
  async occupancyCalendar(organizationId: string, month: string, clientId?: string, clientIds?: string[], formId?: string) {
    if (!clientId) throw new BadRequestException('Selecciona un cliente para ver su ocupación');
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('Formato de mes inválido, usa YYYY-MM');
    if (clientIds !== undefined && !clientIds.includes(clientId)) throw new ForbiddenException('No tienes acceso a este cliente');
    const form = formId ? await this.getForm(organizationId, formId, clientId, clientIds) : null;
    const capacity = form?.dailyCapacity ?? await this.clientDailyCap(this.dataSource, clientId);

    // El día se agrupa en la zona del cliente, no en la de la sesión de MySQL. Con la base en
    // UTC, agrupar por `DATE(starts_at)` mandaba al día siguiente toda reserva desde las 21:00
    // en horario de verano chileno —la franja de cena, la más cargada— mientras el tope
    // diario, que sí usa la zona del formulario, la contaba en el día correcto. El operador
    // veía un día al 60% que en realidad estaba lleno y rechazando reservas.
    //
    // Se agrupa en la aplicación y no con `CONVERT_TZ` porque esa función devuelve nulo
    // cuando el servidor no tiene cargadas las tablas de zonas horarias, algo corriente en
    // alojamiento compartido: el cálculo fallaría en silencio dejando el calendario vacío.
    const timezone = form?.timezone ?? await this.clientTimezone(clientId, organizationId);
    const [year, monthNumber] = month.split('-').map(Number);
    const nextMonth = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}`;
    const from = startOfLocalDayUtc(`${month}-01`, timezone);
    const to = startOfLocalDayUtc(`${nextMonth}-01`, timezone);

    const reservations = await this.reservations.createQueryBuilder('r')
      .select(['r.startsAt'])
      .where('r.organization_id = :organizationId AND r.client_id = :clientId', { organizationId, clientId })
      .andWhere(formId ? 'r.form_id = :formId' : '1=1', formId ? { formId } : {})
      .andWhere("r.status NOT LIKE 'cancelled%'")
      .andWhere('r.starts_at >= :from AND r.starts_at < :to', { from, to })
      .getMany();

    const countByDay = new Map<string, number>();
    for (const reservation of reservations) {
      const key = this.localDateKey(reservation.startsAt, timezone);
      countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
    }
    const rows = [...countByDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, total]) => ({ day, total }));
    return {
      month, capacity,
      days: (rows as Array<{ day: string; total: number }>).map((row) => ({
        date: row.day, count: Number(row.total),
        pct: capacity > 0 ? Math.min(100, Math.round((Number(row.total) / capacity) * 100)) : null,
      })),
    };
  }
  /**
   * Exporta reservas a CSV entregándolas por lotes.
   *
   * Se emite en trozos y no como un texto único porque la cuenta de alojamiento tiene 768 MB
   * para todos los procesos: traer decenas de miles de reservas hidratadas, concatenar el CSV
   * completo y copiarlo otra vez al responder son varios cientos de megas para una sola
   * petición, y el proceso muere llevándose por delante a quien estuviera reservando.
   *
   * Así la memoria depende del tamaño del lote y no del total exportado, de modo que no hace
   * falta un tope que recorte filas en silencio.
   *
   * @param limit - Máximo de filas a exportar; sin valor se exportan todas las que coincidan.
   */
  async *streamCsv(organizationId: string, clientId?: string, clientIds?: string[], from?: string, to?: string, limit?: number): AsyncGenerator<string> {
    const BATCH = 500;
    const baseQuery = () => {
      const qb = this.reservations.createQueryBuilder('r').where('r.organization_id = :organizationId', { organizationId });
      if (clientId) qb.andWhere('r.client_id = :clientId', { clientId });
      else if (clientIds !== undefined) qb.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds });
      if (from) qb.andWhere('r.starts_at >= :from', { from });
      if (to) qb.andWhere('r.starts_at <= :to', { to });
      return qb.orderBy('r.starts_at', 'DESC');
    };

    // Las respuestas del formulario son columnas dinámicas, así que la cabecera solo se
    // conoce tras mirarlas todas. Este primer recorrido trae únicamente esa columna.
    const answerKeys = new Set<string>();
    for await (const rows of this.batches(() => baseQuery().select('r.answers', 'answers'), BATCH, limit, true)) {
      for (const row of rows as Array<{ answers: unknown }>) {
        const answers = typeof row.answers === 'string' ? JSON.parse(row.answers || '{}') : row.answers;
        if (answers && typeof answers === 'object') Object.keys(answers).forEach((key) => answerKeys.add(key));
      }
    }
    const keys = [...answerKeys].sort();

    const escape = (value: unknown) => { const text = String(value ?? ''); const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g, '""')}"`; };
    const toLine = (row: unknown[]) => row.map(escape).join(',');

    yield toLine(['codigo', 'nombre', 'correo', 'telefono', 'fecha', 'estado', 'origen', 'medio', 'campana', 'contenido', 'cupon', 'personas', 'notas_internas', ...keys.map((key) => RESPUESTAS_DEL_SISTEMA[key] || key)]);

    for await (const items of this.batches(baseQuery, BATCH, limit, false)) {
      const lines = (items as Reservation[]).map((item) => {
        const answers = (item.answers || {}) as Record<string, unknown>;
        return toLine([item.referenceCode, item.guestName, item.guestEmail, item.guestPhone, item.startsAt.toISOString(), item.status, item.utmSource, item.utmMedium, item.utmCampaign, item.utmContent, item.couponCode, item.partySize, item.internalNotes, ...keys.map((key) => answers[key])]);
      });
      if (lines.length > 0) yield `\r\n${lines.join('\r\n')}`;
    }
  }

  /** Recorre una consulta por lotes, sin mantener en memoria más de un lote a la vez. */
  private async *batches(build: () => SelectQueryBuilder<Reservation>, size: number, limit: number | undefined, raw: boolean): AsyncGenerator<unknown[]> {
    let offset = 0;
    while (limit === undefined || offset < limit) {
      const take = limit === undefined ? size : Math.min(size, limit - offset);
      const qb = build().skip(offset).take(take);
      const rows = raw ? await qb.getRawMany() : await qb.getMany();
      if (rows.length === 0) return;
      yield rows;
      if (rows.length < take) return;
      offset += rows.length;
    }
  }

  async exportFormReservations(
    organizationId: string,
    formId: string,
    clientId?: string,
    clientIds?: string[],
    format: 'csv' | 'json' | 'pdf' = 'csv',
    dateFrom?: string,
    dateTo?: string,
    fields: string[] = ['name', 'phone', 'email', 'date', 'status', 'attendance'],
    includeInternalNotes = true,
  ) {
    const qb = this.reservations.createQueryBuilder('r').where('r.organization_id = :organizationId', { organizationId }).andWhere('r.form_id = :formId', { formId });
    if (clientId) qb.andWhere('r.client_id = :clientId', { clientId });
    else if (clientIds !== undefined) qb.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds });
    if (dateFrom) qb.andWhere('r.starts_at >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('r.starts_at <= :dateTo', { dateTo });
    const items = await qb.orderBy('r.starts_at', 'DESC').take(50000).getMany();

    /*
     * Las respuestas del formulario viajan siempre, ademas de los campos elegidos.
     *
     * Son las preguntas que cada local configuro, y exportar sin ellas devolvia una planilla
     * que no servia para preparar el servicio: quien la abre necesita la alergia y la silla
     * infantil, no solo el nombre y la hora. La cabecera usa el enunciado publicado, asi que la
     * columna se entiende sin conocer el identificador interno del campo.
     */
    const form = await this.forms.findOne({ where: { id: formId, organizationId } });
    const esquema = (form?.fieldSchema as FieldConfig[] | undefined) ?? [];
    const clavesRespuesta = [...new Set(items.flatMap((item) => Object.keys((item.answers || {}) as Record<string, unknown>)))].sort();
    const etiquetaDe = (clave: string) => esquema.find((campo) => campo.id === clave)?.label || RESPUESTAS_DEL_SISTEMA[clave] || clave;
    const valorDe = (item: Reservation, clave: string) => {
      const valor = ((item.answers || {}) as Record<string, unknown>)[clave];
      if (valor === null || valor === undefined || valor === '') return '';
      if (Array.isArray(valor)) return valor.join(', ');
      if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
      return String(valor);
    };

    const fieldMap: Record<string, (item: Reservation) => string | number | Date | undefined> = {
      name: (item) => item.guestName,
      phone: (item) => item.guestPhone ?? undefined,
      email: (item) => item.guestEmail ?? undefined,
      date: (item) => item.startsAt.toISOString(),
      status: (item) => item.status,
      attendance: (item) => item.status === 'attended' ? 'Sí' : item.status === 'no_show' ? 'No' : '-',
      notes: (item) => item.internalNotes ?? undefined,
      campaign: (item) => item.utmCampaign || '-',
      code: (item) => item.referenceCode,
      origin: (item) => item.utmSource || 'direct',
      medium: (item) => item.utmMedium || '-',
      content: (item) => item.utmContent || '-',
      coupon: (item) => item.couponCode || '-',
      party_size: (item) => item.partySize,
    };

    const allowedFields = includeInternalNotes ? fields : fields.filter((field) => field !== 'notes');
    if (format === 'json') {
      return items.map((item) => {
        const record: Record<string, any> = {};
        for (const field of allowedFields) {
          record[field] = fieldMap[field]?.(item) ?? '-';
        }
        for (const clave of clavesRespuesta) record[etiquetaDe(clave)] = valorDe(item, clave);
        return record;
      });
    } else if (format === 'csv') {
      const escape = (value: unknown) => { const text = String(value ?? ''); const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g, '""')}"`; };
      const headers = [...allowedFields, ...clavesRespuesta.map(etiquetaDe)];
      const filas = items.map((item) => [...allowedFields.map((field) => fieldMap[field]?.(item) ?? '-'), ...clavesRespuesta.map((clave) => valorDe(item, clave))]);
      return [headers, ...filas].map((row) => row.map(escape).join(',')).join('\r\n');
    }

    // El formato PDF se retiró: devolvía texto separado por tabuladores con cabecera de PDF,
    // sin la firma `%PDF-`, así que ningún lector lo abría. Un archivo roto es peor que un
    // formato ausente, porque el fallo aparece recién al abrirlo, fuera de la aplicación.
    // Volverá cuando se genere con una librería real.
    throw new BadRequestException('Formato no soportado');
  }

  async createCoupon(organizationId: string, userId: string, dto: CreateCouponDto, clientId?: string) {
    const code = dto.code.trim().toUpperCase();
    if (!code) throw new BadRequestException('El código es obligatorio');
    const exists = await this.coupons.findOne({ where: { organizationId, code } });
    if (exists) throw new ConflictException('Ya existe un cupón con ese código');
    const validDays = dto.validDaysOfWeek ? [...new Set(dto.validDaysOfWeek)] : undefined;
    if (dto.validFromTime && dto.validUntilTime && this.minutes(dto.validFromTime) >= this.minutes(dto.validUntilTime)) {
      throw new BadRequestException('La hora de inicio del cupón debe ser anterior a la de término');
    }
    const validFrom = dto.validFrom ? new Date(dto.validFrom) : undefined;
    const validUntil = dto.validUntil ? new Date(dto.validUntil) : undefined;
    if (validFrom && validUntil && validUntil <= validFrom) throw new BadRequestException('La fecha de término debe ser posterior a la fecha de inicio');
    const coupon = this.coupons.create({ organizationId, clientId, code, discountType: dto.discountType || 'percentage', value: dto.value ?? 0, maxUses: dto.maxUses ?? 0, validFrom, validUntil, formIds: dto.formIds, validDaysOfWeek: validDays, validFromTime: dto.validFromTime, validUntilTime: dto.validUntilTime });
    return this.coupons.save(coupon);
  }

  async updateCoupon(organizationId: string, id: string, dto: UpdateCouponDto, clientIds?: string[]) {
    const coupon = await this.coupons.findOne({ where: { id, organizationId } });
    if (!coupon) throw new NotFoundException('Cupón no encontrado');
    if (clientIds !== undefined && (!coupon.clientId || !clientIds.includes(coupon.clientId))) throw new ForbiddenException('No tienes acceso a este cupón');
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto).filter(([, value]) => value !== undefined)) {
      if (key === 'validDaysOfWeek') update.validDaysOfWeek = Array.isArray(value) ? [...new Set(value as number[])] : value;
      else if (key === 'validFrom' || key === 'validUntil') update[key] = new Date(value as string);
      else update[key] = value;
    }
    Object.assign(coupon, update);
    if (coupon.validFrom && coupon.validUntil && coupon.validUntil <= coupon.validFrom) throw new BadRequestException('La fecha de término debe ser posterior a la fecha de inicio');
    if (coupon.validFromTime && coupon.validUntilTime && this.minutes(coupon.validFromTime) >= this.minutes(coupon.validUntilTime)) throw new BadRequestException('La hora de inicio del cupón debe ser anterior a la de término');
    return this.coupons.save(coupon);
  }

  listCoupons(organizationId: string, clientId?: string, clientIds?: string[]) {
    const qb = this.coupons.createQueryBuilder('coupon').where('coupon.organization_id = :organizationId', { organizationId });
    if (clientId) qb.andWhere('(coupon.client_id = :clientId OR coupon.client_id IS NULL)', { clientId });
    else if (clientIds?.length) qb.andWhere('(coupon.client_id IN (:...clientIds) OR coupon.client_id IS NULL)', { clientIds });
    else if (clientIds !== undefined) qb.andWhere('coupon.client_id IS NULL');
    return qb.orderBy('coupon.created_at', 'DESC').getMany();
  }

  async validatePublicCoupon(slug: string, code: string, startsAt?: Date) {
    const form = await this.publishedForm(slug);
    const coupon = await this.coupons.findOne({ where: { organizationId: form.organizationId, code: code.trim().toUpperCase(), active: true } });
    if (!coupon) throw new BadRequestException('Cupón no válido');
    if (coupon.clientId && coupon.clientId !== form.clientId) throw new BadRequestException('Cupón no válido');
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) throw new BadRequestException('El cupón aún no está activo');
    if (coupon.validUntil && now > coupon.validUntil) throw new BadRequestException('El cupón ha expirado');
    if (coupon.maxUses > 0 && coupon.usageCount >= coupon.maxUses) throw new BadRequestException('El cupón ya no tiene usos disponibles');
    if (coupon.formIds && coupon.formIds.length > 0 && !coupon.formIds.includes(form.id)) throw new BadRequestException('El cupón no aplica para este formulario');
    if ((coupon.validDaysOfWeek?.length || coupon.validFromTime || coupon.validUntilTime) && !startsAt) throw new BadRequestException('Selecciona un horario para validar este cupón');
    if (startsAt) this.assertCouponSchedule(coupon, form, startsAt);
    return { valid: true, discountType: coupon.discountType, value: coupon.value };
  }

  /**
   * Resuelve el cupón aplicable a una reserva, o lanza explicando por qué no aplica.
   *
   * La vigencia por fecha (`validFrom`/`validUntil`) y los usos disponibles se miden contra
   * el momento de reservar, porque acotan la campaña. El día de la semana y la franja
   * horaria se miden contra `startsAt`: describen cuándo se consume el beneficio, no cuándo
   * se pide. Un cupón de martes debe aceptarse aunque se reserve un domingo.
   *
   * @param code - Código ingresado por el comensal.
   * @param form - Formulario de la reserva, que aporta la zona horaria.
   * @param startsAt - Inicio de la reserva, en UTC.
   */
  private async validateCoupon(code: string | undefined, form: ReservationForm, manager: EntityManager, startsAt: Date): Promise<ReservationCoupon | undefined> {
    if (!code) return undefined;
    const coupon = await manager.getRepository(ReservationCoupon).findOne({ where: { organizationId: form.organizationId, code: code.trim().toUpperCase(), active: true }, lock: { mode: 'pessimistic_write' } });
    if (!coupon) throw new BadRequestException('Cupón no válido');
    if (coupon.clientId && coupon.clientId !== form.clientId) throw new BadRequestException('Cupón no válido');
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) throw new BadRequestException('El cupón aún no está activo');
    if (coupon.validUntil && now > coupon.validUntil) throw new BadRequestException('El cupón ha expirado');
    if (coupon.maxUses > 0 && coupon.usageCount >= coupon.maxUses) throw new BadRequestException('El cupón ya no tiene usos disponibles');
    if (coupon.formIds && coupon.formIds.length > 0 && !coupon.formIds.includes(form.id)) throw new BadRequestException('El cupón no aplica para este formulario');

    this.assertCouponSchedule(coupon, form, startsAt);
    return coupon;
  }

  private assertCouponSchedule(coupon: ReservationCoupon, form: ReservationForm, startsAt: Date): void {
    const local = new Intl.DateTimeFormat('en-US', { timeZone: form.timezone, hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' })
      .formatToParts(startsAt)
      .reduce<Record<string, string>>((parts, part) => ({ ...parts, [part.type]: part.value }), {});
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(local.weekday);

    if (coupon.validDaysOfWeek && coupon.validDaysOfWeek.length > 0 && !coupon.validDaysOfWeek.includes(weekday)) {
      throw new BadRequestException('El cupón no es válido para el día de la reserva');
    }
    if (coupon.validFromTime || coupon.validUntilTime) {
      const minutes = Number(local.hour) * 60 + Number(local.minute);
      const from = coupon.validFromTime ? this.minutes(coupon.validFromTime) : 0;
      const until = coupon.validUntilTime ? this.minutes(coupon.validUntilTime) : 24 * 60;
      if (minutes < from || minutes >= until) {
        throw new BadRequestException(`El cupón solo aplica entre ${coupon.validFromTime ?? '00:00'} y ${coupon.validUntilTime ?? '23:59'}`);
      }
    }
  }
}
