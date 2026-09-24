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
var CuponPostVisitaJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CuponPostVisitaJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const reservation_entity_1 = require("../../../modules/reservations/domain/reservation.entity");
const reservation_form_entity_1 = require("../../../modules/reservations/domain/reservation-form.entity");
const email_service_1 = require("../../notifications/email.service");
const plantilla_de_correo_1 = require("../../notifications/plantilla-de-correo");
const parameter_resolver_service_1 = require("../../parameters/parameter-resolver.service");
const UNA_HORA = 60 * 60 * 1000;
const HORAS_DE_ESPERA = 24;
const DIAS_HACIA_ATRAS = 7;
const DIAS_ENTRE_CUPONES = 60;
const TOPE_POR_PASADA = 300;
let CuponPostVisitaJob = CuponPostVisitaJob_1 = class CuponPostVisitaJob {
    constructor(reservas, formularios, correo, parametros) {
        this.reservas = reservas;
        this.formularios = formularios;
        this.correo = correo;
        this.parametros = parametros;
        this.logger = new common_1.Logger(CuponPostVisitaJob_1.name);
    }
    async handle() {
        const ahora = Date.now();
        const hasta = new Date(ahora - HORAS_DE_ESPERA * UNA_HORA);
        const desde = new Date(ahora - DIAS_HACIA_ATRAS * 24 * UNA_HORA);
        const reservas = await this.reservas.find({
            where: {
                status: 'attended',
                endsAt: (0, typeorm_2.Between)(desde, hasta),
                guestEmail: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()),
                cuponEnviadoEn: (0, typeorm_2.IsNull)(),
            },
            take: TOPE_POR_PASADA,
            order: { endsAt: 'ASC' },
        });
        let enviados = 0;
        const formulariosPorId = new Map();
        const ajustesPorEmpresa = new Map();
        for (const reserva of reservas) {
            try {
                let form = formulariosPorId.get(reserva.formId);
                if (form === undefined) {
                    form = await this.formularios.findOne({ where: { id: reserva.formId } });
                    formulariosPorId.set(reserva.formId, form);
                }
                if (!form)
                    continue;
                const clave = `${form.organizationId}:${form.clientId}`;
                let ajustes = ajustesPorEmpresa.get(clave);
                if (ajustes === undefined) {
                    ajustes = await this.ajustesDe(form);
                    ajustesPorEmpresa.set(clave, ajustes);
                }
                if (!ajustes)
                    continue;
                const recienteParaEsaPersona = await this.reservas.count({
                    where: {
                        formId: reserva.formId,
                        guestEmail: reserva.guestEmail,
                        cuponEnviadoEn: (0, typeorm_2.MoreThan)(new Date(ahora - DIAS_ENTRE_CUPONES * 24 * UNA_HORA)),
                    },
                });
                if (recienteParaEsaPersona > 0) {
                    await this.reservas.update(reserva.id, { cuponEnviadoEn: new Date() });
                    continue;
                }
                const vence = new Date(ahora + ajustes.diasValidez * 24 * UNA_HORA);
                const { subject, html } = (0, plantilla_de_correo_1.componerCorreo)(ajustes.asunto, ajustes.cuerpo, {
                    nombre: reserva.guestName?.trim().split(/\s+/)[0] || '',
                    local: form.name,
                    cupon: ajustes.codigo,
                    vence: vence.toLocaleDateString('es-CL', { dateStyle: 'long', timeZone: form.timezone }),
                });
                const soporte = typeof form.designConfig?.supportEmail === 'string'
                    ? String(form.designConfig.supportEmail)
                    : undefined;
                const salio = await this.correo.send(reserva.guestEmail, subject, html, soporte ? { replyTo: soporte } : undefined);
                if (!salio)
                    continue;
                await this.reservas.update(reserva.id, { cuponEnviadoEn: new Date() });
                enviados += 1;
            }
            catch (error) {
                this.logger.error(`No se pudo enviar el cupón de la reserva ${reserva.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        return { enviados, revisados: reservas.length };
    }
    async ajustesDe(form) {
        const leer = (clave) => this.parametros.get(clave, form.clientId, null, form.organizationId);
        const [encendido, codigo, asunto, cuerpo, dias] = await Promise.all([
            leer('email.coupon_enabled'),
            leer('email.coupon_code'),
            leer('email.coupon_subject'),
            leer('email.coupon_body'),
            leer('email.coupon_days_valid'),
        ]);
        if (!encendido)
            return null;
        const codigoLimpio = String(codigo ?? '').trim();
        if (!codigoLimpio) {
            this.logger.warn(`Cupón encendido sin código en la empresa ${form.clientId}: no se envía nada`);
            return null;
        }
        const diasValidez = Number(dias);
        return {
            codigo: codigoLimpio,
            asunto: String(asunto ?? 'Un regalo de {{local}} para ti'),
            cuerpo: String(cuerpo ?? '{{nombre}}, gracias por venir a {{local}}.\n\nTe dejamos este código: {{cupon}}\n\nMuéstralo cuando vuelvas. Válido hasta el {{vence}}.'),
            diasValidez: Number.isFinite(diasValidez) && diasValidez >= 1 && diasValidez <= 365 ? diasValidez : 30,
        };
    }
};
exports.CuponPostVisitaJob = CuponPostVisitaJob;
exports.CuponPostVisitaJob = CuponPostVisitaJob = CuponPostVisitaJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(reservation_entity_1.Reservation)),
    __param(1, (0, typeorm_1.InjectRepository)(reservation_form_entity_1.ReservationForm)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        email_service_1.EmailService,
        parameter_resolver_service_1.ParameterResolver])
], CuponPostVisitaJob);
