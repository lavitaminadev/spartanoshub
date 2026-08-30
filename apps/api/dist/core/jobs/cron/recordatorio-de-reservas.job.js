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
var RecordatorioDeReservasJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordatorioDeReservasJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const reservation_entity_1 = require("../../../modules/reservations/domain/reservation.entity");
const reservation_form_entity_1 = require("../../../modules/reservations/domain/reservation-form.entity");
const email_service_1 = require("../../notifications/email.service");
const plantilla_de_correo_1 = require("../../notifications/plantilla-de-correo");
const parameter_resolver_service_1 = require("../../parameters/parameter-resolver.service");
const UNA_HORA = 3_600_000;
const HORAS_POR_DEFECTO = 24;
const CERRADAS = ['cancelled', 'no_show', 'attended', 'completed'];
let RecordatorioDeReservasJob = RecordatorioDeReservasJob_1 = class RecordatorioDeReservasJob {
    constructor(reservas, formularios, correo, parametros) {
        this.reservas = reservas;
        this.formularios = formularios;
        this.correo = correo;
        this.parametros = parametros;
        this.logger = new common_1.Logger(RecordatorioDeReservasJob_1.name);
    }
    async handle() {
        const ahora = new Date();
        const candidatas = await this.reservas.find({
            where: {
                startsAt: (0, typeorm_2.Between)(ahora, new Date(ahora.getTime() + 168 * UNA_HORA)),
                status: (0, typeorm_2.Not)((0, typeorm_2.In)(CERRADAS)),
                reminderSentAt: (0, typeorm_2.IsNull)(),
            },
            take: 500,
        });
        const ajustesPorFormulario = new Map();
        let enviados = 0;
        for (const reserva of candidatas) {
            try {
                if (!reserva.guestEmail)
                    continue;
                const form = await this.formularios.findOne({ where: { id: reserva.formId } });
                if (!form)
                    continue;
                let ajustes = ajustesPorFormulario.get(form.id);
                if (ajustes === undefined) {
                    ajustes = await this.ajustesDe(form);
                    ajustesPorFormulario.set(form.id, ajustes);
                }
                if (!ajustes?.encendido)
                    continue;
                const faltan = (reserva.startsAt.getTime() - ahora.getTime()) / UNA_HORA;
                if (faltan > ajustes.horas)
                    continue;
                await this.enviar(form, reserva);
                await this.reservas.update(reserva.id, { reminderSentAt: new Date() });
                enviados += 1;
            }
            catch (error) {
                this.logger.error(`No se pudo recordar la reserva ${reserva.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        this.logger.log(`Recordatorios de reserva enviados: ${enviados} de ${candidatas.length} revisadas`);
    }
    async ajustesDe(form) {
        const [encendido, horas] = await Promise.all([
            this.parametros.get('email.reservation_reminder_enabled', form.clientId, null, form.organizationId),
            this.parametros.get('email.reservation_reminder_hours', form.clientId, null, form.organizationId),
        ]);
        return {
            encendido: Boolean(encendido),
            horas: Number(horas ?? HORAS_POR_DEFECTO),
        };
    }
    async enviar(form, reserva) {
        const [asunto, cuerpo] = await Promise.all([
            this.parametros.get('email.reservation_reminder_subject', form.clientId, null, form.organizationId),
            this.parametros.get('email.reservation_reminder_body', form.clientId, null, form.organizationId),
        ]);
        const { subject, html } = (0, plantilla_de_correo_1.componerCorreo)(String(asunto ?? 'Mañana te esperamos en {{local}}'), String(cuerpo ?? 'Te recordamos tu reserva en {{local}} el {{fecha}}.'), {
            nombre: reserva.guestName,
            local: form.name,
            fecha: reserva.startsAt.toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short' }),
            personas: reserva.partySize,
            codigo: reserva.referenceCode,
        });
        await this.correo.send(reserva.guestEmail, subject, html);
    }
};
exports.RecordatorioDeReservasJob = RecordatorioDeReservasJob;
exports.RecordatorioDeReservasJob = RecordatorioDeReservasJob = RecordatorioDeReservasJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(reservation_entity_1.Reservation)),
    __param(1, (0, typeorm_1.InjectRepository)(reservation_form_entity_1.ReservationForm)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        email_service_1.EmailService,
        parameter_resolver_service_1.ParameterResolver])
], RecordatorioDeReservasJob);
