import { IsBoolean, IsEmail, IsObject, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Consentimiento del envío público. Separado del resto porque su finalidad (registrar
 * evidencia de consentimiento) es distinta de la finalidad comercial de los demás campos.
 */
export class PublicLeadConsentDto {
  @IsBoolean() privacyAccepted: boolean;
  @IsOptional() @IsBoolean() marketingAccepted?: boolean;
  @IsOptional() @IsString() @MaxLength(40) policyVersion?: string;
}

/**
 * Datos de atribución de campaña, iguales en espíritu a los que ya captura la reserva pública.
 *
 * `fbp` y `fbc` merecen mención aparte: son las dos señales que más pesan en la calidad de
 * atribución de la Conversions API y **solo existen en el navegador de quien envía el
 * formulario**. `fbp` es la cookie `_fbp` que planta el Pixel; `fbc` se deriva del `fbclid`
 * con que Meta marca el clic. Ninguna de las dos puede reconstruirse después: si no se
 * capturan en este instante, la conversión que se envíe más adelante viajará sin ellas y
 * Meta la atribuirá peor. Por eso viajan acá y no se calculan en el servidor.
 */
export class PublicLeadTrackingDto {
  @IsOptional() @IsString() @MaxLength(120) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(120) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(180) utmCampaign?: string;
  @IsOptional() @IsString() @MaxLength(180) utmContent?: string;
  @IsOptional() @IsString() @MaxLength(120) utmTerm?: string;
  @IsOptional() @IsString() @MaxLength(255) fbclid?: string;
  @IsOptional() @IsString() @MaxLength(255) gclid?: string;

  /** Cookie `_fbp` del Pixel, tal cual la entrega el navegador. */
  @IsOptional() @IsString() @MaxLength(255) fbp?: string;

  /**
   * Parámetro de clic de Meta ya formateado (`fb.1.<timestamp>.<fbclid>`).
   *
   * Se acepta formado desde el cliente porque el navegador conoce el momento del clic; el
   * servidor solo lo derivaría del `fbclid` con una marca de tiempo equivocada.
   */
  @IsOptional() @IsString() @MaxLength(255) fbc?: string;

  /** Anuncio y conjunto de anuncios, cuando la página de destino los recibe por parámetro. */
  @IsOptional() @IsString() @MaxLength(120) adId?: string;
  @IsOptional() @IsString() @MaxLength(120) adsetId?: string;

  @IsOptional() @IsString() @MaxLength(500) landingUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) referrer?: string;
}

/**
 * Envío público de un formulario de captación comercial (Dominio B — prospectos de La
 * Vitamina). No confundir con `PublicReservationDto`: ese es Dominio A (comensales que
 * reservan en un restaurante cliente) y usa un endpoint, tabla de eventos y flujo de
 * conversión CAPI completamente distintos. Este DTO nunca debe tocar `reservations.service.ts`.
 */
export class PublicLeadSubmissionDto {
  @IsString() @MinLength(2) @MaxLength(180) name: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @Matches(/^[\d+\-\s()]+$/, { message: 'Invalid phone format' }) @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(255) company?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(255) website?: string;
  @IsOptional() @IsString() @MaxLength(120) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(255) serviceInterest?: string;
  @IsOptional() @IsString() @MaxLength(60) budgetRange?: string;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;

  @IsObject() @ValidateNested() @Type(() => PublicLeadConsentDto) consent: PublicLeadConsentDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => PublicLeadTrackingDto) tracking?: PublicLeadTrackingDto;

  /**
   * Campo trampa: un formulario real nunca lo llena porque va oculto por CSS; un bot que
   * completa todos los inputs del DOM sí. Si llega con valor, el envío se descarta.
   */
  @IsOptional() @IsString() @MaxLength(200) company_website_confirm?: string;

  /**
   * Identificador que el formulario genera una vez por envío.
   *
   * Sirve para que un reenvío del mismo formulario —doble clic, reintento del navegador— no
   * deje dos leads. Es solo una guardia contra repeticiones: el endpoint es anónimo, así que
   * la clave nunca autoriza a escribir sobre un lead que ya existe.
   *
   * El formato exigido es el de un identificador generado al azar (`crypto.randomUUID()` y
   * similares). Debe ser impredecible: una clave corta o adivinable permitiría enumerar los
   * envíos de otras personas.
   */
  @IsString() @MinLength(16) @MaxLength(80) @Matches(/^[A-Za-z0-9_-]{16,80}$/, { message: 'idempotencyKey debe ser un identificador aleatorio de 16 a 80 caracteres (A-Z, a-z, 0-9, guion o guion bajo)' })
  idempotencyKey: string;
}
