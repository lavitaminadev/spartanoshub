import { BadRequestException, Body, Controller, Get, Headers, Ip, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../core/auth/decorators/public.decorator';
import { ReservationsService } from './application/reservations.service';
import { CouponValidateDto, PublicFormEventDto, PublicGroupRequestDto, PublicLookupReservationDto, PublicRecoverReservationDto, PublicReservationDto, PublicReservationHoldDto, PublicRescheduleReservationDto, PublicSurveyResponseDto } from './dto/reservation.dto';

@Public()
@ApiTags('Reservas publicas')
@Controller('public/reservations')
export class PublicReservationsController {
  constructor(private service: ReservationsService) {}

  /**
   * URL que se declara a Meta como origen del evento.
   *
   * La arma el servidor. La del cliente solo se acepta si apunta al mismo host público, y
   * únicamente para conservar los parámetros de campaña que traiga: es un endpoint sin
   * autenticar, así que cualquiera podía declarar un dominio ajeno y ensuciar el Events
   * Manager del cliente, o mandar un texto que no fuera una URL y hacer que Meta rechazara
   * el evento con un 400 que el outbox clasifica como definitivo.
   *
   * El `Referer` tampoco sirve como fuente: lo controla igualmente quien llama.
   */
  private eventSourceUrl(slug: string, candidate?: string): string | undefined {
    const publicOrigin = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
    const fallback = publicOrigin ? `${publicOrigin}/book/${encodeURIComponent(slug)}` : undefined;
    if (!candidate || !publicOrigin) return fallback;

    try {
      return new URL(candidate).origin === new URL(publicOrigin).origin ? candidate : fallback;
    } catch {
      return fallback;
    }
  }

  /** Enlace opaco enviado sólo a quien hizo la reserva. */
  @Get('manage/:token')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  management(@Param('token') token: string) { return this.service.publicManagement(token); }

  @Post('manage/:token/cancel')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  cancelManagement(@Param('token') token: string) { return this.service.cancelPublicManagement(token); }

  @Post('manage/:token/reschedule')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  rescheduleManagement(@Param('token') token: string, @Body() dto: PublicRescheduleReservationDto) {
    return this.service.reschedulePublicManagement(token, dto.startsAt, dto.partySize);
  }

  @Post('manage/:token/confirm')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  confirmManagement(@Param('token') token: string) { return this.service.confirmPublicManagement(token); }

  /** Quien reservó recupera su enlace de gestión con el código y su correo o teléfono. */
  @Post(':slug/lookup')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  lookup(@Param('slug') slug: string, @Body() dto: PublicLookupReservationDto) {
    return this.service.lookupPublicReservation(slug, dto.referenceCode, dto.contact);
  }

  /** Reenvía el enlace de gestión al correo de la reserva, para quien perdió el código. */
  @Post(':slug/recover')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  recover(@Param('slug') slug: string, @Body() dto: PublicRecoverReservationDto) {
    return this.service.recoverPublicReservations(slug, dto.contact);
  }

  @Post(':slug/hold')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  hold(@Param('slug') slug: string, @Body() dto: PublicReservationHoldDto) { return this.service.holdPublic(slug, dto); }

  @Get(':slug')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  form(@Param('slug') slug: string) {
    return this.service.publicForm(slug);
  }

  @Get(':slug/slots')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  slots(
    @Param('slug') slug: string,
    @Query('from') from: string,
    @Query('days') days?: string,
    @Query('partySize') partySize?: string,
    @Query('serviceId') serviceId?: string,
    @Query('resourceId') resourceId?: string,
  ) {
    return this.service.slots(slug, from, Number(days || 14), serviceId, resourceId, Number(partySize || 1));
  }

  @Post(':slug/events')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  event(
    @Param('slug') slug: string,
    @Body() dto: PublicFormEventDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    // La IP y el user-agent se leen de la petición y no del cuerpo: un dato que el navegador
    // puede escribir no sirve para atribuir.
    return this.service.trackPublicEvent(slug, dto, ipAddress, userAgent);
  }

  @Post(':slug/coupon-validate')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async validateCoupon(@Param('slug') slug: string, @Body() dto: CouponValidateDto) {
    const code = dto.code?.trim();
    if (!code) throw new BadRequestException('Codigo requerido');
    return this.service.validatePublicCoupon(slug, code, dto.startsAt ? new Date(dto.startsAt) : undefined);
  }

  @Post(':slug/survey')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  survey(
    @Param('slug') slug: string,
    @Body() dto: PublicSurveyResponseDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.service.createPublicSurveyResponse(slug, dto, ipAddress, userAgent, this.eventSourceUrl(slug, dto.eventSourceUrl));
  }

  @Post(':slug/group-request')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  groupRequest(@Param('slug') slug: string, @Body() dto: PublicGroupRequestDto) {
    return this.service.createPublicGroupRequest(slug, dto);
  }

  @Post(':slug/waitlist')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  waitlist(@Param('slug') slug: string, @Body() dto: PublicReservationDto) {
    return this.service.joinPublicWaitlist(slug, dto);
  }

  @Post(':slug')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(
    @Param('slug') slug: string,
    @Body() dto: PublicReservationDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.service.createPublic(slug, dto, ipAddress, userAgent, this.eventSourceUrl(slug, dto.eventSourceUrl));
  }
}
