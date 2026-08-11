"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var RecoverReservationIntegrationsJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoverReservationIntegrationsJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const reservation_entity_1 = require("../../../modules/reservations/domain/reservation.entity");
const reservation_form_entity_1 = require("../../../modules/reservations/domain/reservation-form.entity");
const google_calendar_service_1 = require("../../../modules/integrations/google/google-calendar.service");
const lead_intake_service_1 = require("../../../modules/crm/leads/lead-intake.service");
const MAX_AGE_DAYS = 7;
const MIN_AGE_MINUTES = 5;
const BATCH = 50;
let RecoverReservationIntegrationsJob = RecoverReservationIntegrationsJob_1 = class RecoverReservationIntegrationsJob {
    constructor(reservations, forms, calendar, leadIntake) {
        this.reservations = reservations;
        this.forms = forms;
        this.calendar = calendar;
        this.leadIntake = leadIntake;
        this.logger = new common_1.Logger(RecoverReservationIntegrationsJob_1.name);
    }
    async handle() {
        const now = Date.now();
        const createdAfter = new Date(now - MAX_AGE_DAYS * 86_400_000);
        const createdBefore = new Date(now - MIN_AGE_MINUTES * 60_000);
        let calendar = 0;
        let crm = 0;
        let failed = 0;
        for (const booking of await this.pending('calendar_event_id', createdAfter, createdBefore)) {
            const form = await this.formOf(booking);
            if (!form?.calendarEnabled)
                continue;
            try {
                const event = await this.calendar.createEvent(form.organizationId, {
                    summary: `${form.name}: ${booking.guestName}`,
                    description: `Reserva ${booking.referenceCode}`,
                    start: booking.startsAt,
                    durationMinutes: Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60000),
                });
                await this.reservations.update(booking.id, { calendarEventId: event.externalId, calendarUrl: event.calendarUrl });
                calendar += 1;
            }
            catch (error) {
                failed += 1;
                this.logger.warn(`Calendario pendiente de la reserva ${booking.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        for (const booking of await this.pending('contact_id', createdAfter, createdBefore)) {
            const form = await this.formOf(booking);
            if (!form?.crmEnabled)
                continue;
            try {
                const { contact } = await this.leadIntake.captureAudience({
                    organizationId: form.organizationId,
                    clientId: form.clientId,
                    name: booking.guestName,
                    email: booking.guestEmail ?? undefined,
                    phone: booking.guestPhone ?? undefined,
                    source: 'vitahub_reservations',
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
            }
            catch (error) {
                failed += 1;
                this.logger.warn(`CRM pendiente de la reserva ${booking.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        if (calendar || crm || failed) {
            this.logger.log(`Integraciones recuperadas: ${calendar} de calendario, ${crm} de CRM, ${failed} con error`);
        }
        return { calendar, crm, failed };
    }
    pending(column, createdAfter, createdBefore) {
        return this.reservations.createQueryBuilder('r')
            .where(`r.${column} IS NULL`)
            .andWhere('r.created_at > :createdAfter', { createdAfter })
            .andWhere('r.created_at < :createdBefore', { createdBefore })
            .andWhere('r.status NOT IN (:...inactive)', { inactive: INACTIVE_STATUSES })
            .orderBy('r.created_at', 'ASC')
            .take(BATCH)
            .getMany();
    }
    formOf(booking) {
        return this.forms.findOne({ where: { id: booking.formId, organizationId: booking.organizationId } });
    }
};
exports.RecoverReservationIntegrationsJob = RecoverReservationIntegrationsJob;
exports.RecoverReservationIntegrationsJob = RecoverReservationIntegrationsJob = RecoverReservationIntegrationsJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(reservation_entity_1.Reservation)),
    __param(1, (0, typeorm_1.InjectRepository)(reservation_form_entity_1.ReservationForm)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        google_calendar_service_1.GoogleCalendarService,
        lead_intake_service_1.LeadIntakeService])
], RecoverReservationIntegrationsJob);
const INACTIVE_STATUSES = ['cancelled', 'cancelled_by_guest', 'cancelled_by_client', 'no_show'];
//# sourceMappingURL=recover-reservation-integrations.job.js.map