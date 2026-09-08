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
var AutoCloseReservationsJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoCloseReservationsJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const reservation_entity_1 = require("../../../modules/reservations/domain/reservation.entity");
const reservation_form_entity_1 = require("../../../modules/reservations/domain/reservation-form.entity");
const reservation_event_entity_1 = require("../../../modules/reservations/domain/reservation-event.entity");
const ACTIVE = new Set(['pending', 'confirmed', 'rescheduled']);
let AutoCloseReservationsJob = AutoCloseReservationsJob_1 = class AutoCloseReservationsJob {
    constructor(reservations, forms, events) {
        this.reservations = reservations;
        this.forms = forms;
        this.events = events;
        this.logger = new common_1.Logger(AutoCloseReservationsJob_1.name);
    }
    async handle() {
        const candidates = await this.reservations.find({ where: { endsAt: (0, typeorm_2.LessThan)(new Date()) }, take: 500, order: { endsAt: 'ASC' } });
        let closed = 0;
        for (const item of candidates) {
            if (!ACTIVE.has(item.status))
                continue;
            try {
                const form = await this.forms.findOne({ where: { id: item.formId } });
                const config = (form?.designConfig || {});
                if (config.autoCloseAttendance === false)
                    continue;
                const configured = Number(config.autoCloseAfterMinutes);
                const afterMinutes = Number.isInteger(configured) && configured >= 15 && configured <= 24 * 60 ? configured : 60;
                if (item.endsAt.getTime() + afterMinutes * 60_000 > Date.now())
                    continue;
                const previous = item.status;
                const affected = await this.reservations.createQueryBuilder().update(reservation_entity_1.Reservation)
                    .set({ status: 'attended' })
                    .where('id = :id AND status = :status', { id: item.id, status: previous }).execute();
                if (!affected.affected)
                    continue;
                await this.events.save(this.events.create({
                    organizationId: item.organizationId, clientId: item.clientId, reservationId: item.id,
                    type: 'status_changed', fromStatus: previous, toStatus: 'attended', actorType: 'system',
                    metadata: { via: 'automatic_day_close', afterMinutes },
                }));
                closed += 1;
            }
            catch (error) {
                this.logger.error(`No se pudo cerrar automáticamente ${item.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        if (closed)
            this.logger.log(`Reservas cerradas automáticamente: ${closed}`);
    }
};
exports.AutoCloseReservationsJob = AutoCloseReservationsJob;
exports.AutoCloseReservationsJob = AutoCloseReservationsJob = AutoCloseReservationsJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(reservation_entity_1.Reservation)),
    __param(1, (0, typeorm_1.InjectRepository)(reservation_form_entity_1.ReservationForm)),
    __param(2, (0, typeorm_1.InjectRepository)(reservation_event_entity_1.ReservationEvent)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AutoCloseReservationsJob);
