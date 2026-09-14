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
var EncuestaPostVisitaJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncuestaPostVisitaJob = exports.MARGEN_MAXIMO_HORAS = exports.HORAS_POST_VISITA_POR_DEFECTO = void 0;
exports.encuestaUtil = encuestaUtil;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const reservation_entity_1 = require("../../../modules/reservations/domain/reservation.entity");
const reservation_form_entity_1 = require("../../../modules/reservations/domain/reservation-form.entity");
const survey_entity_1 = require("../../../modules/surveys/survey.entity");
const invitacion_a_encuesta_1 = require("../../../modules/surveys/invitacion-a-encuesta");
const email_service_1 = require("../../notifications/email.service");
const plantilla_de_correo_1 = require("../../notifications/plantilla-de-correo");
const parameter_resolver_service_1 = require("../../parameters/parameter-resolver.service");
const UNA_HORA = 3_600_000;
exports.HORAS_POST_VISITA_POR_DEFECTO = 3;
exports.MARGEN_MAXIMO_HORAS = 48;
let EncuestaPostVisitaJob = EncuestaPostVisitaJob_1 = class EncuestaPostVisitaJob {
    constructor(reservas, formularios, encuestas, correo, parametros) {
        this.reservas = reservas;
        this.formularios = formularios;
        this.encuestas = encuestas;
        this.correo = correo;
        this.parametros = parametros;
        this.logger = new common_1.Logger(EncuestaPostVisitaJob_1.name);
    }
    async handle() {
        const ahora = Date.now();
        const secreto = process.env.JWT_SECRET || '';
        const origen = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
        if (!secreto || !origen) {
            this.logger.warn('Encuesta post-visita omitida: falta JWT_SECRET o APP_PUBLIC_URL para armar el enlace');
            return { enviados: 0, revisados: 0 };
        }
        const candidatas = await this.reservas.find({
            where: {
                status: 'attended',
                postVisitSurveySentAt: (0, typeorm_2.IsNull)(),
                guestEmail: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()),
                endsAt: (0, typeorm_2.Between)(new Date(ahora - (72 + exports.MARGEN_MAXIMO_HORAS) * UNA_HORA), new Date(ahora)),
            },
            take: 500,
        });
        const ajustesPorEmpresa = new Map();
        const encuestasPorId = new Map();
        let enviados = 0;
        for (const reserva of candidatas) {
            try {
                const form = await this.formularios.findOne({ where: { id: reserva.formId } });
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
                const desde = reserva.endsAt.getTime() + ajustes.horas * UNA_HORA;
                if (ahora < desde)
                    continue;
                if (ahora > desde + exports.MARGEN_MAXIMO_HORAS * UNA_HORA)
                    continue;
                let encuesta = encuestasPorId.get(ajustes.surveyId);
                if (encuesta === undefined) {
                    encuesta = await this.encuestas.findOne({ where: { id: ajustes.surveyId } });
                    encuestasPorId.set(ajustes.surveyId, encuesta);
                }
                if (!encuesta || !encuestaUtil(encuesta, form))
                    continue;
                const enlace = `${origen}/survey/${encodeURIComponent(encuesta.id)}?src=email&i=${encodeURIComponent((0, invitacion_a_encuesta_1.crearInvitacion)(encuesta.id, reserva.id, secreto))}`;
                const { subject, html } = (0, plantilla_de_correo_1.componerCorreo)(ajustes.asunto, ajustes.cuerpo, {
                    nombre: reserva.guestName?.trim().split(/\s+/)[0] || '',
                    local: form.name,
                    fecha: reserva.startsAt.toLocaleDateString('es-CL', { dateStyle: 'long', timeZone: form.timezone }),
                }, { texto: 'Contar cómo nos fue', url: enlace });
                const soporte = typeof form.designConfig?.supportEmail === 'string'
                    ? String(form.designConfig.supportEmail) : undefined;
                const salio = await this.correo.send(reserva.guestEmail, subject, html, soporte ? { replyTo: soporte } : undefined);
                if (!salio)
                    continue;
                await this.reservas.update(reserva.id, { postVisitSurveySentAt: new Date() });
                enviados += 1;
            }
            catch (error) {
                this.logger.error(`No se pudo encuestar la reserva ${reserva.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        this.logger.log(`Encuestas post-visita enviadas: ${enviados} de ${candidatas.length} revisadas`);
        return { enviados, revisados: candidatas.length };
    }
    async ajustesDe(form) {
        const leer = (clave) => this.parametros.get(clave, form.clientId, null, form.organizationId);
        const [encendido, surveyId, horas, asunto, cuerpo] = await Promise.all([
            leer('email.post_visit_survey_enabled'),
            leer('email.post_visit_survey_id'),
            leer('email.post_visit_survey_hours'),
            leer('email.post_visit_survey_subject'),
            leer('email.post_visit_survey_body'),
        ]);
        if (!encendido || typeof surveyId !== 'string' || !surveyId.trim())
            return null;
        const horasValidas = Number(horas);
        return {
            surveyId: surveyId.trim(),
            horas: Number.isFinite(horasValidas) && horasValidas >= 1 && horasValidas <= 72 ? horasValidas : exports.HORAS_POST_VISITA_POR_DEFECTO,
            asunto: String(asunto ?? '¿Cómo te fue en {{local}}?'),
            cuerpo: String(cuerpo ?? 'Hola {{nombre}}:\n\nGracias por venir a {{local}}. ¿Nos cuentas cómo te fue? Es un minuto.'),
        };
    }
};
exports.EncuestaPostVisitaJob = EncuestaPostVisitaJob;
exports.EncuestaPostVisitaJob = EncuestaPostVisitaJob = EncuestaPostVisitaJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(reservation_entity_1.Reservation)),
    __param(1, (0, typeorm_1.InjectRepository)(reservation_form_entity_1.ReservationForm)),
    __param(2, (0, typeorm_1.InjectRepository)(survey_entity_1.Survey)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        email_service_1.EmailService,
        parameter_resolver_service_1.ParameterResolver])
], EncuestaPostVisitaJob);
function encuestaUtil(encuesta, form) {
    if (encuesta.status !== 'active' || encuesta.type !== 'customer')
        return false;
    return !encuesta.clientId || encuesta.clientId === form.clientId;
}
