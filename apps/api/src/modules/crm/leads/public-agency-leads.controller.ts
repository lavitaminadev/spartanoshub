import { BadRequestException, Body, Controller, ForbiddenException, Headers, Ip, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import { Public } from '../../../core/auth/decorators/public.decorator';
import { LeadIntakeService } from './lead-intake.service';
import { PublicLeadSubmissionDto } from './dto/public-lead-submission.dto';

/**
 * Captura pública de leads COMERCIALES de La Vitamina (empresas que quieren contratar a la
 * agencia) — Dominio B. No confundir con `public-reservations.controller.ts`, que es Dominio A
 * (comensales que reservan en un restaurante cliente): tablas, deduplicación y flujo de
 * conversión a Meta distintos.
 *
 * Todo lead capturado acá se guarda con `domain: 'commercial'` (forzado en el service, no
 * confiado al llamador) para que nunca pueda mezclarse con la audiencia de reservas.
 *
 * La organización destino es la propia La Vitamina (`AGENCY_ORGANIZATION_ID`), no un valor
 * recibido del cliente — un endpoint público jamás debe decidir en qué organización escribe.
 */
@Public()
@ApiTags('CRM Agencia (público)')
@Controller('public/agency-crm/leads')
export class PublicAgencyLeadsController {
  constructor(private readonly leadIntake: LeadIntakeService) {}

  private agencyOrganizationId(): string {
    const id = process.env.AGENCY_ORGANIZATION_ID;
    if (!id) throw new ForbiddenException('El formulario de contacto no está disponible por ahora');
    return id;
  }

  @Post('submissions')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async submit(
    @Body() dto: PublicLeadSubmissionDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    // Honeypot: un formulario real deja este campo vacío porque está oculto por CSS; se
    // descarta en silencio para no darle a un bot la señal de que fue detectado.
    if (dto.company_website_confirm) {
      return { success: true, submissionId: randomUUID(), message: 'Información recibida correctamente' };
    }
    if (!dto.consent.privacyAccepted) {
      throw new BadRequestException('Debes aceptar el aviso de privacidad para continuar');
    }
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Se requiere al menos un correo o un teléfono de contacto');
    }

    const organizationId = this.agencyOrganizationId();
    const messageParts = [dto.message, dto.serviceInterest ? `Interés: ${dto.serviceInterest}` : undefined, dto.budgetRange ? `Presupuesto: ${dto.budgetRange}` : undefined]
      .filter(Boolean);

    // `create-only`: un envío anónimo puede dar de alta un prospecto, nunca reescribir uno que
    // ya existe. La clave de idempotencia solo evita que un reenvío duplique la captura.
    await this.leadIntake.captureLead({
      organizationId,
      domain: 'commercial',
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      company: dto.company,
      source: dto.tracking?.utmSource || 'website',
      sourceDetail: dto.tracking?.utmMedium,
      campaignName: dto.tracking?.utmCampaign,
      notes: messageParts.length > 0 ? messageParts.join(' | ') : undefined,
      externalLeadId: `public-form:${dto.idempotencyKey}`,
      consentCapturedAt: dto.consent.privacyAccepted ? new Date() : undefined,
      metadata: {
        website: dto.website,
        jobTitle: dto.jobTitle,
        tracking: dto.tracking ? { ...dto.tracking } : undefined,
        /**
         * Señales de atribución conservadas para poder enviar la conversión más adelante.
         *
         * Se guardan al capturar y no al convertir porque `fbp`, `fbc`, la IP y el
         * user-agent describen el momento en que la persona llegó, y ese momento no vuelve:
         * cuando el trato se gane, semanas después, ya no habrá forma de averiguarlos.
         *
         * La IP y el user-agent se leen de la petición y no del cuerpo: un dato que el
         * cliente puede escribir no sirve para atribuir.
         */
        attribution: {
          fbp: dto.tracking?.fbp,
          fbc: dto.tracking?.fbc,
          fbclid: dto.tracking?.fbclid,
          gclid: dto.tracking?.gclid,
          adId: dto.tracking?.adId,
          adsetId: dto.tracking?.adsetId,
          campaignId: dto.tracking?.utmCampaign,
          landingUrl: dto.tracking?.landingUrl,
          referrer: dto.tracking?.referrer,
          clientIpAddress: ipAddress || undefined,
          clientUserAgent: userAgent || undefined,
          capturedAt: new Date().toISOString(),
          /**
           * Identificador del evento de captura, estable y derivado de la clave de
           * idempotencia. Permite deduplicar contra el Pixel del navegador si más adelante
           * se emite un `Lead` por las dos vías.
           */
          captureEventId: `lead-capture:${dto.idempotencyKey}`,
        },
        /**
         * Se promueven al primer nivel porque es donde el resto del sistema los busca: el
         * handler de conversiones decide si un lead vino de Meta mirando `metadata.adId`.
         * Sin esto, alguien que llega desde un anuncio a la web —y no por el formulario
         * nativo de Meta— nunca generaba la conversión, porque su `source` es `website`.
         */
        adId: dto.tracking?.adId,
        adsetId: dto.tracking?.adsetId,
        consent: { marketingAccepted: Boolean(dto.consent.marketingAccepted), policyVersion: dto.consent.policyVersion },
      },
    }, 'create-only');

    // Respuesta pública mínima: nunca el id interno del lead, pipeline, responsable ni estado.
    return { success: true, submissionId: randomUUID(), message: 'Información recibida correctamente' };
  }
}
