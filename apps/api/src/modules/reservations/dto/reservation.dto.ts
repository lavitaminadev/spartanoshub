import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, IsUrl, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** Tipos de pregunta que acepta el esquema de un formulario o encuesta. */
export const FORM_FIELD_TYPES = ['text', 'textarea', 'email', 'phone', 'select', 'multi_select', 'number', 'date', 'consent', 'coupon', 'rating', 'nps'] as const;

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
  @IsOptional() @IsString() @MaxLength(50) guestPhone?: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) partySize?: number;
  @IsOptional() @IsString() @MaxLength(80) serviceId?: string;
  @IsOptional() @IsString() @MaxLength(80) resourceId?: string;
  @IsObject() answers: Record<string, unknown>;
  @IsString() @MinLength(24) @MaxLength(80) @Matches(/^[A-Za-z0-9_-]+$/, { message: 'La clave de idempotencia no es válida' }) idempotencyKey: string;
  @IsOptional() @IsString() @MaxLength(80) consentVersion?: string;
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
export class UpdateReservationDto {
  @IsOptional() @IsIn(['pending','confirmed','rescheduled','cancelled_client','cancelled_business','attended','no_show','waitlist']) status?: string;
  @IsOptional() @IsString() @MaxLength(10000) internalNotes?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  /**
   * Etapa del flujo de producción agencia → cliente.
   *
   * Es independiente de `status`, que describe la asistencia: una reserva confirmada puede
   * estar en preparación, en ejecución o entregada sin que su asistencia cambie.
   */
  @IsOptional() @IsIn(['draft','sent','confirmed','preparation','execution','delivered']) workflowState?: string;
}
export class PublicFormEventDto { @IsIn(['view','start']) type: string; @IsOptional() @IsString() @MaxLength(80) sessionId?: string; @IsOptional() @IsString() @MaxLength(120) utmSource?: string; @IsOptional() @IsString() @MaxLength(180) utmCampaign?: string; }
export class PublicSurveyResponseDto {
  @IsString() @Matches(/\S/, { message: 'El nombre es obligatorio' }) @MaxLength(180) guestName: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() @MaxLength(50) guestPhone?: string;
  @IsObject() answers: Record<string, unknown>;
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
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
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
