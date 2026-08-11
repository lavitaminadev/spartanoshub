import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation } from '../../../modules/reservations/domain/reservation.entity';
import { ReservationForm } from '../../../modules/reservations/domain/reservation-form.entity';
import { GoogleCalendarService } from '../../../modules/integrations/google/google-calendar.service';
import { LeadIntakeService } from '../../../modules/crm/leads/lead-intake.service';
import { RESERVATION_LEAD_SOURCE } from '@espartanos/shared';

/** Antigüedad máxima de una reserva para intentar recuperar su integración. */
const MAX_AGE_DAYS = 7;

/** Margen antes del primer intento, para no competir con el que ocurre al confirmar. */
const MIN_AGE_MINUTES = 5;

const BATCH = 50;

/**
 * Recupera las integraciones que no llegaron a completarse al confirmar una reserva.
 *
 * El calendario y el CRM se resuelven después de confirmar y fuera de la transacción, que es
 * lo correcto —una reserva confirmada no debe revertirse porque un sistema externo no
 * responda—, pero hasta ahora un fallo ahí era definitivo: se escribía un evento
 * `integration_failed` que no leía nadie, y la reserva quedaba sin contacto o sin evento de
 * calendario de forma permanente y silenciosa.
 *
 * No hace falta una cola aparte porque los propios datos dicen qué falta: una reserva sin
 * `calendar_event_id` en un formulario con calendario activo es exactamente una pendiente.
 * Eso cubre además el caso que una cola en memoria no cubre —que el proceso muera entre la
 * confirmación y el intento—, porque la marca vive en la base y no en el proceso.
 */
@Injectable()
export class RecoverReservationIntegrationsJob {
  private readonly logger = new Logger(RecoverReservationIntegrationsJob.name);

  constructor(
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    @InjectRepository(ReservationForm) private readonly forms: Repository<ReservationForm>,
    private readonly calendar: GoogleCalendarService,
    private readonly leadIntake: LeadIntakeService,
  ) {}

  async handle(): Promise<{ calendar: number; crm: number; failed: number }> {
    const now = Date.now();
    const createdAfter = new Date(now - MAX_AGE_DAYS * 86_400_000);
    const createdBefore = new Date(now - MIN_AGE_MINUTES * 60_000);

    let calendar = 0;
    let crm = 0;
    let failed = 0;

    for (const booking of await this.pending('calendar_event_id', createdAfter, createdBefore)) {
      const form = await this.formOf(booking);
      if (!form?.calendarEnabled) continue;
      try {
        const event = await this.calendar.createEvent(form.organizationId, {
          summary: `${form.name}: ${booking.guestName}`,
          description: `Reserva ${booking.referenceCode}`,
          start: booking.startsAt,
          durationMinutes: Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60000),
        });
        await this.reservations.update(booking.id, { calendarEventId: event.externalId, calendarUrl: event.calendarUrl });
        calendar += 1;
      } catch (error) {
        // Se registra y se sigue: una reserva con datos que el calendario rechaza no debe
        // impedir recuperar las demás. Al próximo pase se vuelve a intentar, y al superar la
        // ventana deja de aparecer.
        failed += 1;
        this.logger.warn(`Calendario pendiente de la reserva ${booking.id}: ${error instanceof Error ? error.message : error}`);
      }
    }

    for (const booking of await this.pending('contact_id', createdAfter, createdBefore)) {
      const form = await this.formOf(booking);
      if (!form?.crmEnabled) continue;
      try {
        const { contact } = await this.leadIntake.captureAudience({
          organizationId: form.organizationId,
          clientId: form.clientId,
          name: booking.guestName,
          email: booking.guestEmail ?? undefined,
          phone: booking.guestPhone ?? undefined,
          source: RESERVATION_LEAD_SOURCE,
          sourceDetail: form.name,
          status: 'reserved',
          externalLeadId: `reservation:${booking.id}`,
          externalFormId: form.id,
          externalCampaignId: form.campaignId,
          campaignName: booking.utmCampaign,
          metadata: { reservationId: booking.id, referenceCode: booking.referenceCode, recovered: true },
        });
        if (contact?.id) {
          await this.reservations.update(booking.id, { contactId: contact.id });
          crm += 1;
        }
      } catch (error) {
        failed += 1;
        this.logger.warn(`CRM pendiente de la reserva ${booking.id}: ${error instanceof Error ? error.message : error}`);
      }
    }

    if (calendar || crm || failed) {
      this.logger.log(`Integraciones recuperadas: ${calendar} de calendario, ${crm} de CRM, ${failed} con error`);
    }
    return { calendar, crm, failed };
  }

  /**
   * Reservas activas a las que les falta la columna indicada.
   *
   * La ventana tiene dos extremos: no se toca lo recién creado, para no competir con el
   * intento que ocurre al confirmar, y se abandona lo que ya es viejo, porque reponer el
   * evento de calendario de una reserva que ya pasó no le sirve a nadie.
   */
  private pending(column: 'calendar_event_id' | 'contact_id', createdAfter: Date, createdBefore: Date): Promise<Reservation[]> {
    return this.reservations.createQueryBuilder('r')
      .where(`r.${column} IS NULL`)
      .andWhere('r.created_at > :createdAfter', { createdAfter })
      .andWhere('r.created_at < :createdBefore', { createdBefore })
      .andWhere('r.status NOT IN (:...inactive)', { inactive: INACTIVE_STATUSES })
      .orderBy('r.created_at', 'ASC')
      .take(BATCH)
      .getMany();
  }

  private formOf(booking: Reservation): Promise<ReservationForm | null> {
    return this.forms.findOne({ where: { id: booking.formId, organizationId: booking.organizationId } });
  }
}

/** Una reserva cancelada o no presentada no necesita ni calendario ni contacto. */
const INACTIVE_STATUSES = ['cancelled', 'cancelled_by_guest', 'cancelled_by_client', 'no_show'];
