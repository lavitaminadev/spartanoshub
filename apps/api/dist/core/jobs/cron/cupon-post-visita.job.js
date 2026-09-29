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
const client_capability_service_1 = require("../../client-scope/client-capability.service");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const reservation_entity_1 = require("../../../modules/reservations/domain/reservation.entity");
const reservation_form_entity_1 = require("../../../modules/reservations/domain/reservation-form.entity");
const reservation_coupon_entity_1 = require("../../../modules/reservations/domain/reservation-coupon.entity");
const encuestas_de_la_empresa_1 = require("../../../modules/surveys/encuestas-de-la-empresa");
const email_service_1 = require("../../notifications/email.service");
const plantilla_de_correo_1 = require("../../notifications/plantilla-de-correo");
const parameter_resolver_service_1 = require("../../parameters/parameter-resolver.service");
const UNA_HORA = 60 * 60 * 1000;
const HORAS_DE_ESPERA = 24;
const DIAS_HACIA_ATRAS = 7;
const DIAS_ENTRE_CUPONES = 60;
const TOPE_POR_PASADA = 300;
let CuponPostVisitaJob = CuponPostVisitaJob_1 = class CuponPostVisitaJob {
    constructor(reservas, formularios, cupones, correo, parametros, servicios) {
        this.reservas = reservas;
        this.formularios = formularios;
        this.cupones = cupones;
        this.correo = correo;
        this.parametros = parametros;
        this.servicios = servicios;
        this.logger = new common_1.Logger(CuponPostVisitaJob_1.name);
    }
    async handle() {
        const ahora = Date.now();
        const desde = new Date(ahora - DIAS_HACIA_ATRAS * 24 * UNA_HORA);
        const porAsistencia = await this.reservas.find({
            where: {
                status: 'attended',
                endsAt: (0, typeorm_2.Between)(desde, new Date(ahora - HORAS_DE_ESPERA * UNA_HORA)),
                guestEmail: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()),
                cuponEnviadoEn: (0, typeorm_2.IsNull)(),
            },
            take: TOPE_POR_PASADA,
            order: { endsAt: 'ASC' },
        });
        const porEncuesta = await this.reservasConEncuestaRespondida(desde);
        const candidatas = [
            ...porAsistencia.map((reserva) => ({ reserva, disparador: 'asistencia' })),
            ...porEncuesta.map((reserva) => ({ reserva, disparador: 'encuesta' })),
        ];
        let enviados = 0;
        const yaVistas = new Set();
        const formulariosPorId = new Map();
        const ajustesPorEmpresa = new Map();
        for (const { reserva, disparador } of candidatas) {
            if (yaVistas.has(reserva.id))
                continue;
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
                if (!ajustes || ajustes.disparador !== disparador)
                    continue;
                yaVistas.add(reserva.id);
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
                const porDias = new Date(ahora + ajustes.diasValidez * 24 * UNA_HORA);
                const vence = ajustes.vigenteHasta && ajustes.vigenteHasta < porDias ? ajustes.vigenteHasta : porDias;
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
        return { enviados, revisados: candidatas.length };
    }
    async reservasConEncuestaRespondida(desde) {
        const filas = await this.reservas.query(`SELECT DISTINCT r.id
         FROM reservations r
         JOIN survey_responses s ON s.reservation_id = r.id
        WHERE s.completed_at IS NOT NULL
          AND s.completed_at >= ?
          AND r.guest_email IS NOT NULL
          AND r.cupon_enviado_en IS NULL
        LIMIT ${TOPE_POR_PASADA}`, [desde]).catch(() => []);
        if (filas.length === 0)
            return [];
        return this.reservas.find({ where: filas.map((fila) => ({ id: fila.id })) });
    }
    async ajustesDe(form) {
        if (this.servicios && form.clientId && !(await this.servicios.enServicio(form.organizationId, form.clientId, 'reservations')))
            return null;
        const leer = (clave) => this.parametros.get(clave, form.clientId, null, form.organizationId);
        const [encendido, codigo, asunto, cuerpo, dias, momento] = await Promise.all([
            leer('email.coupon_enabled'),
            leer('email.coupon_code'),
            leer('email.coupon_subject'),
            leer('email.coupon_body'),
            leer('email.coupon_days_valid'),
            leer('email.coupon_trigger'),
        ]);
        if (!encendido)
            return null;
        const codigoLimpio = String(codigo ?? '').trim().toUpperCase();
        if (!codigoLimpio) {
            this.logger.warn(`Cupón encendido sin código en la empresa ${form.clientId}: no se envía nada`);
            return null;
        }
        const cupon = await this.cupones.findOne({ where: { organizationId: form.organizationId, code: codigoLimpio } });
        const ahora = new Date();
        const problema = !cupon ? 'no existe'
            : cupon.clientId !== form.clientId ? 'es de otra empresa'
                : !cupon.active ? 'está desactivado'
                    : cupon.validUntil && cupon.validUntil <= ahora ? 'ya venció'
                        : cupon.maxUses > 0 && cupon.usageCount >= cupon.maxUses ? 'no le quedan usos'
                            : null;
        if (problema) {
            this.logger.warn(`El cupón ${codigoLimpio} de la empresa ${form.clientId} ${problema}: no se envía nada`);
            return null;
        }
        const disparador = momento === 'encuesta' ? 'encuesta' : 'asistencia';
        if (disparador === 'encuesta' && !(await (0, encuestas_de_la_empresa_1.encuestasHabilitadas)(this.reservas, form.clientId))) {
            this.logger.warn(`El cupón de la empresa ${form.clientId} espera la encuesta, pero no tiene Encuestas: no se envía nada`);
            return null;
        }
        const diasValidez = Number(dias);
        return {
            codigo: codigoLimpio,
            asunto: String(asunto ?? 'Un regalo de {{local}} para ti'),
            cuerpo: String(cuerpo ?? '{{nombre}}, gracias por venir a {{local}}.\n\nTe dejamos este código: {{cupon}}\n\nMuéstralo cuando vuelvas. Válido hasta el {{vence}}.'),
            diasValidez: Number.isFinite(diasValidez) && diasValidez >= 1 && diasValidez <= 365 ? diasValidez : 30,
            disparador,
            vigenteHasta: cupon.validUntil ?? null,
        };
    }
};
exports.CuponPostVisitaJob = CuponPostVisitaJob;
exports.CuponPostVisitaJob = CuponPostVisitaJob = CuponPostVisitaJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(reservation_entity_1.Reservation)),
    __param(1, (0, typeorm_1.InjectRepository)(reservation_form_entity_1.ReservationForm)),
    __param(2, (0, typeorm_1.InjectRepository)(reservation_coupon_entity_1.ReservationCoupon)),
    __param(5, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        email_service_1.EmailService,
        parameter_resolver_service_1.ParameterResolver,
        client_capability_service_1.ClientCapabilityService])
], CuponPostVisitaJob);
