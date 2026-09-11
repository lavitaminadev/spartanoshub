import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, IsUrl, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * Un filtro que el panel deja en blanco llega como cadena vacia, y `@IsOptional()` solo
 * omite `undefined` y `null`. Normalizarla a `undefined` hace que un filtro sin usar se
 * comporte como un filtro ausente.
 */
const vacioComoAusente = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

/** Tipos de pregunta que acepta el esquema de un formulario o encuesta. */
export const FORM_FIELD_TYPES = ['text', 'textarea', 'email', 'phone', 'select', 'multi_select', 'number', 'date', 'consent', 'coupon', 'rating', 'nps'] as const;

/**
 * Número móvil chileno, con o sin prefijo de país y con espacios o guiones
 * opcionales. No se normaliza aquí: la validación protege la puerta pública y
 * la normalización de identidad ocurre en el servicio que consume el dato.
 */
export const CHILEAN_MOBILE_PHONE = /^(?:\+?56[\s-]?)?9[\s-]?\d{4}[\s-]?\d{4}$/;
export const CHILEAN_MOBILE_PHONE_MESSAGE = 'Ingresa un celular chileno válido, por ejemplo +56 9 1234 5678';

/**
 * Una pregunta del esquema de un formulario o encuesta.
 *
 * Se valida con `class-validator` en vez de aceptar JSON libre porque `fieldSchema` viaja a la
 * página pública y define qué respuestas se aceptan: un tipo desconocido o unas opciones mal
 * formadas dejarían el formulario publicado sin poder renderizarse.
 *
 * Las opciones sólo tienen sentido en los tipos de selección; en el resto se rechazan para que
 * no queden datos muertos en la columna que después nadie sabe si aplican.
 */
export class FormFieldDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,80}$/, { message: 'El identificador del campo no es válido' }) id: string;
  @IsIn(FORM_FIELD_TYPES as unknown as string[]) type: string;
  @IsString() @Matches(/\S/, { message: 'Cada campo necesita un enunciado' }) @MaxLength(180) label: string;
  @IsOptional() @IsBoolean() required?: boolean;
  /** Campo base del formulario (nombre, correo, teléfono): no se puede eliminar desde la UI. */
  @IsOptional() @IsBoolean() system?: boolean;
  /** Se guarda pero no se expone en la página pública. */
  @IsOptional() @IsBoolean() internal?: boolean;
  @IsOptional() @IsString() @MaxLength(180) placeholder?: string;
  @IsOptional() @IsIn(['radio', 'select']) display?: string;
  /**
   * Alternativas de un campo de selección.
   *
   * Que estén presentes en los tipos de selección y ausentes en el resto lo decide
   * `validateConfiguration`, que mira el esquema completo; acá sólo se comprueba la forma.
   */
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(180, { each: true })
  options?: string[];
}

export class CreateReservationFormDto {
  @IsUUID() clientId: string;
  @IsString() @Matches(/\S/, { message: 'El nombre es obligatorio' }) @MaxLength(180) name: string;
  @IsOptional() @IsString() @MaxLength(190) publicSlug?: string;
  @IsOptional() @IsIn(['appointment', 'group', 'request', 'survey']) mode?: string;
}
export class UpdateReservationFormDto {
  @IsOptional() @IsString() @MaxLength(180) name?: string;
  @IsOptional() @IsIn(['draft', 'published', 'paused']) status?: string;
  @IsOptional() @IsString() @MaxLength(80) timezone?: string;
  @IsOptional() @IsInt() @Min(5) @Max(1440) durationMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(240) bufferMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(500) capacityPerSlot?: number;
  @IsOptional() @IsInt() @Min(0) @Max(5000) dailyCapacity?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3650) maximumAdvanceDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(8760) minimumNoticeHours?: number;
  @IsOptional() @IsIn(['automatic', 'manual']) confirmationMode?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(80) @ValidateNested({ each: true }) @Type(() => FormFieldDto) fieldSchema?: FormFieldDto[];
  @IsOptional() @IsObject() designConfig?: Record<string, unknown>;
  @IsOptional() @IsObject() scheduleConfig?: Record<string, unknown>;
  @IsOptional() @IsArray() servicesConfig?: unknown[];
  @IsOptional() @IsArray() resourcesConfig?: unknown[];
  @IsOptional() @IsString() @MaxLength(120) campaignId?: string;
  @IsOptional() @IsBoolean() crmEnabled?: boolean;
  @IsOptional() @IsBoolean() calendarEnabled?: boolean;
  @IsOptional() @IsBoolean() metaCapiEnabled?: boolean;
  @IsOptional() @Matches(/^(G-[A-Z0-9]{4,20})?$/i, { message: 'El ID de medición GA4 debe tener el formato G-XXXXXXXXXX' }) ga4MeasurementId?: string;
  @IsOptional() @IsArray() @IsEmail({}, { each: true }) teamNotifications?: string[];
}
export class CreateBlockDto { @IsDateString() startsAt: string; @IsDateString() endsAt: string; @IsOptional() @IsString() @MaxLength(180) reason?: string; }
export class CouponValidateDto { @IsString() @MaxLength(80) code: string; @IsOptional() @IsDateString() startsAt?: string; }
export class PublicReservationDto {
  @IsDateString() startsAt: string;
  @IsString() @Matches(/\S/, { message: 'El nombre es obligatorio' }) @MaxLength(180) guestName: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() @Matches(CHILEAN_MOBILE_PHONE, { message: CHILEAN_MOBILE_PHONE_MESSAGE }) @MaxLength(50) guestPhone?: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) partySize?: number;
  @IsOptional() @IsIn(['cumpleanos', 'aniversario', 'empresa', 'otro']) groupEventType?: string;
  @IsOptional() @IsString() @MaxLength(1000) groupEventNotes?: string;
  @IsOptional() @IsInt() @Min(0) @Max(20) childrenCount?: number;
  @IsOptional() @IsString() @MaxLength(500) accessibilityNeed?: string;
  @IsOptional() @IsString() @MaxLength(1000) dietaryNotes?: string;
  @IsOptional() @IsString() @MaxLength(80) serviceId?: string;
  @IsOptional() @IsString() @MaxLength(80) resourceId?: string;
  @IsObject() answers: Record<string, unknown>;
  @IsString() @MinLength(24) @MaxLength(80) @Matches(/^[A-Za-z0-9_-]+$/, { message: 'La clave de idempotencia no es válida' }) idempotencyKey: string;
  @IsOptional() @IsString() @MaxLength(80) consentVersion?: string;
  @IsOptional() @IsBoolean() reservationConsent?: boolean;
  @IsOptional() @IsBoolean() marketingConsent?: boolean;
  @IsOptional() @IsBoolean() measurementConsent?: boolean;
  @IsOptional() @IsString() @MaxLength(30) marketingConsentVersion?: string;
  /**
   * Si marcó la casilla de ser mayor de 18 años.
   *
   * Llega como booleano y se guarda como instante: lo que hace falta responder cuando alguien
   * reclama es «desde cuándo», no «sí o no».
   */
  @IsOptional() @IsBoolean() adultDeclared?: boolean;
  @IsOptional() @IsString() @MaxLength(120) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(120) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(180) utmCampaign?: string;
  @IsOptional() @IsString() @MaxLength(180) utmContent?: string;
  /** @deprecated Lo siguen enviando los formularios en caché. Se interpreta como `gclid`. */
  @IsOptional() @IsString() @MaxLength(255) clickId?: string;
  @IsOptional() @IsString() @MaxLength(255) gclid?: string;
  @IsOptional() @IsString() @MaxLength(255) gbraid?: string;
  @IsOptional() @IsString() @MaxLength(255) wbraid?: string;
  @IsOptional() @IsString() @MaxLength(255) fbclid?: string;
  @IsOptional() @IsString() @MaxLength(255) fbc?: string;
  @IsOptional() @IsString() @MaxLength(255) fbp?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }) @MaxLength(2048) eventSourceUrl?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsDateString() renderedAt?: string;
  @IsOptional() @IsString() @MaxLength(80) couponCode?: string;
}
/** Solicitud comercial/operativa sin tomar un horario de la agenda. */
export class PublicGroupRequestDto {
  @IsString() @Matches(/\S/, { message: 'El nombre es obligatorio' }) @MaxLength(180) guestName: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() @Matches(CHILEAN_MOBILE_PHONE, { message: CHILEAN_MOBILE_PHONE_MESSAGE }) @MaxLength(50) guestPhone?: string;
  @IsInt() @Min(2) @Max(500) partySize: number;
  @IsIn(['cumpleanos', 'aniversario', 'empresa', 'otro']) eventType: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) preferredDate?: string;
  @IsOptional() @IsString() @MaxLength(80) preferredTime?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsBoolean() reservationConsent: boolean;
  @IsOptional() @IsBoolean() marketingConsent?: boolean;
  @IsString() @MinLength(24) @MaxLength(80) @Matches(/^[A-Za-z0-9_-]+$/, { message: 'La clave de idempotencia no es válida' }) idempotencyKey: string;
  @IsOptional() @IsString() @MaxLength(120) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(120) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(180) utmCampaign?: string;
  @IsOptional() @IsString() @MaxLength(180) utmContent?: string;
  /** Respuestas y preferencias operativas que el equipo debe conservar al cotizar. */
  @IsOptional() @IsObject() details?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsDateString() renderedAt?: string;
}
/** Cambio de horario desde el enlace privado que recibió quien reservó. */
export class PublicRescheduleReservationDto {
  @IsDateString() startsAt: string;
}
export class PublicReservationHoldDto {
  @IsDateString() startsAt: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) partySize?: number;
  /** Datos operativos para solicitudes de grupo; no se usan como perfil de marketing. */
  @IsOptional() @IsIn(['cumpleanos', 'aniversario', 'empresa', 'otro']) groupEventType?: string;
  @IsOptional() @IsString() @MaxLength(1000) groupEventNotes?: string;
  @IsOptional() @IsString() @MaxLength(80) serviceId?: string;
  @IsOptional() @IsString() @MaxLength(80) resourceId?: string;
  @IsString() @MinLength(24) @MaxLength(80) @Matches(/^[A-Za-z0-9_-]+$/, { message: 'La clave de retención no es válida' }) holdKey: string;
  /**
   * Mismas senales anti-automatizacion que el alta publica. Son opcionales para no romper una
   * pagina servida desde cache que todavia no las envie, pero cuando llegan se exigen: retener
   * cupo consume inventario real y era el unico camino publico sin ninguna comprobacion.
   */
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsDateString() renderedAt?: string;
}
export class CloseReservationDayDto {
  @IsUUID() formId: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class UpdateReservationDto {
  @IsOptional() @IsIn(['pending','confirmed','rescheduled','cancelled_client','cancelled_business','attended','no_show','waitlist']) status?: string;
  @IsOptional() @IsString() @MaxLength(10000) internalNotes?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsString() @MaxLength(500) cancellationReason?: string;
  /**
   * Etapa del flujo de producción agencia → cliente.
   *
   * Es independiente de `status`, que describe la asistencia: una reserva confirmada puede
   * estar en preparación, en ejecución o entregada sin que su asistencia cambie.
   */
  @IsOptional() @IsIn(['draft','sent','confirmed','preparation','execution','delivered']) workflowState?: string;
}
export class UpdateGroupRequestDto { @IsIn(['pending', 'contacted', 'quoted', 'closed']) status: string; @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(999999999) quoteAmount?: number; @IsOptional() @IsString() @MaxLength(5000) quoteMessage?: string; @IsOptional() @IsDateString() quoteExpiresAt?: string; }
/**
 * Evento de uso del formulario público.
 *
 * `start` viaja además a Meta como `InitiateCheckout`, así que trae las señales del navegador
 * que hacen falta para emparejarlo. Quien no las mande sigue funcionando: el evento se guarda
 * igual y la conversión sale con menos precisión, pero nunca se pierde.
 */
export class PublicFormEventDto {
  @IsIn(['view', 'start']) type: string;
  /** Sin aceptación no se envía el evento a proveedores de medición. */
  @IsOptional() @IsBoolean() measurementConsent?: boolean;
  @IsOptional() @IsString() @MaxLength(80) sessionId?: string;
  @IsOptional() @IsString() @MaxLength(120) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(120) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(180) utmCampaign?: string;
  @IsOptional() @IsString() @MaxLength(180) utmContent?: string;
  @IsOptional() @IsString() @MaxLength(255) fbc?: string;
  @IsOptional() @IsString() @MaxLength(255) fbp?: string;
  @IsOptional() @IsString() @MaxLength(500) eventSourceUrl?: string;
}
export class PublicSurveyResponseDto {
  @IsString() @Matches(/\S/, { message: 'El nombre es obligatorio' }) @MaxLength(180) guestName: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() @MaxLength(50) guestPhone?: string;
  @IsObject() answers: Record<string, unknown>;
  @IsOptional() @IsBoolean() measurementConsent?: boolean;
  @IsString() @MinLength(24) @MaxLength(80) @Matches(/^[A-Za-z0-9_-]+$/, { message: 'La clave de idempotencia no es válida' }) idempotencyKey: string;
  @IsOptional() @IsString() @MaxLength(120) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(120) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(180) utmCampaign?: string;
  @IsOptional() @IsString() @MaxLength(180) utmContent?: string;
  /** @deprecated Lo siguen enviando los formularios en caché. Se interpreta como `gclid`. */
  @IsOptional() @IsString() @MaxLength(255) clickId?: string;
  @IsOptional() @IsString() @MaxLength(255) gclid?: string;
  @IsOptional() @IsString() @MaxLength(255) gbraid?: string;
  @IsOptional() @IsString() @MaxLength(255) wbraid?: string;
  @IsOptional() @IsString() @MaxLength(255) fbclid?: string;
  @IsOptional() @IsString() @MaxLength(255) fbc?: string;
  @IsOptional() @IsString() @MaxLength(255) fbp?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }) @MaxLength(2048) eventSourceUrl?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

/**
 * Solicitud de contacto que deja quien calificó por debajo del umbral de reseña.
 *
 * `responseId` es la respuesta de encuesta recién creada: acota la solicitud a alguien que
 * efectivamente respondió, en vez de dejar el endpoint abierto a cualquier envío.
 */
export class PublicContactRequestDto {
  @IsUUID() responseId: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

/** Cambio de estado de una solicitud de contacto desde el panel del equipo. */
export class UpdateContactRequestDto {
  @IsIn(['pending', 'contacted', 'resolved']) status: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CreateCouponDto {
  /** Empresa dueña del cupón. Sin ella el cupón sería canjeable en cualquier formulario. */
  @IsUUID() clientId: string;
  @IsString() @Matches(/\S/, { message: 'El código es obligatorio' }) @MaxLength(80) code: string;
  @IsOptional() @IsIn(['percentage','fixed']) discountType?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) value?: number;
  @IsOptional() @IsInt() @Min(0) maxUses?: number;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID('4', { each: true }) formIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) validDaysOfWeek?: number[];
  /** Franja horaria de la reserva, `HH:MM` en la zona del formulario. */
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) validFromTime?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) validUntilTime?: string;
}
export class CreateManualReservationDto {
  @IsUUID() formId: string;
  @IsDateString() startsAt: string;
  @IsString() @Matches(/\S/, { message: 'El nombre es obligatorio' }) @MaxLength(180) guestName: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() @MaxLength(50) guestPhone?: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) partySize?: number;
  @IsOptional() @IsString() @MaxLength(80) serviceId?: string;
  @IsOptional() @IsString() @MaxLength(80) resourceId?: string;
  @IsOptional() @IsObject() answers?: Record<string, unknown>;
  @IsOptional() @IsBoolean() skipAvailability?: boolean;
  @IsOptional() @IsString() @MaxLength(10000) internalNotes?: string;
}

export class ImportReservationsDto {
  @IsUUID() formId: string;
  /** Contenido del CSV en texto plano. */
  @IsString() @MaxLength(1_000_000) csvContent: string;
  /** Sólo valida y devuelve la vista previa, sin crear nada. */
  @IsOptional() @IsBoolean() dryRun?: boolean;
  /** Para cargar histórico que ya ocurrió. */
  @IsOptional() @IsBoolean() skipAvailability?: boolean;
}

export class ListReservationsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsUUID() formId?: string;
  @IsOptional() @IsIn(['pending','confirmed','rescheduled','cancelled_client','cancelled_business','attended','no_show','waitlist']) status?: string;
  @IsOptional() @Transform(vacioComoAusente) @IsDateString() from?: string;
  @IsOptional() @Transform(vacioComoAusente) @IsDateString() to?: string;
  @IsOptional() @IsString() @MaxLength(180) search?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsString() @MaxLength(80) couponCode?: string;
}
export class UpdateCouponDto {
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100) value?: number;
  @IsOptional() @IsInt() @Min(0) maxUses?: number;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID('4', { each: true }) formIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) validDaysOfWeek?: number[];
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) validFromTime?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) validUntilTime?: string;
}

export class ExportFormReservationsDto {
  @IsIn(['csv', 'json']) format: 'csv' | 'json';
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsArray() @IsString({ each: true }) @MaxLength(120, { each: true }) fields: string[];
}

export class ReservationScopeDto {
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days?: number;
}

/**
 * Alcance del calendario de ocupación, que además necesita el mes.
 *
 * El mes se declara acá y no se lee con un `@Query('month')` aparte porque la validación
 * global corre con `forbidNonWhitelisted`: al validar el objeto completo contra un DTO que no
 * declaraba `month`, la petición se rechazaba con «property month should not exist» aunque
 * todos sus valores fueran correctos.
 */
export class OccupancyQueryDto extends ReservationScopeDto {
  @IsString() @Matches(/^\d{4}-\d{2}$/, { message: 'El mes debe tener el formato YYYY-MM' })
  month: string;
  /** Si se elige un local, nunca se agregan sus reservas con las de los demás locales del cliente. */
  @IsOptional() @IsUUID() formId?: string;
}
