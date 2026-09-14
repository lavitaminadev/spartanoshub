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
var PublicSurveyFlowService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicSurveyFlowService = void 0;
const common_1 = require("@nestjs/common");
const encuestas_de_la_empresa_1 = require("./encuestas-de-la-empresa");
const typeorm_1 = require("@nestjs/typeorm");
const node_crypto_1 = require("node:crypto");
const typeorm_2 = require("typeorm");
const survey_entity_1 = require("./survey.entity");
const survey_response_entity_1 = require("./survey-response.entity");
const invitacion_a_encuesta_1 = require("./invitacion-a-encuesta");
const flujo_de_encuesta_1 = require("./flujo-de-encuesta");
const email_service_1 = require("../../core/notifications/email.service");
const shared_1 = require("@espartanos/shared");
const consentimiento_de_encuesta_1 = require("./consentimiento-de-encuesta");
const plantilla_de_correo_1 = require("../../core/notifications/plantilla-de-correo");
function hashDelToken(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
}
function urlDeResena(valor) {
    try {
        const url = new URL(valor.trim());
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
    }
    catch {
        return null;
    }
}
function secretoDeInvitaciones() {
    return process.env.JWT_SECRET || '';
}
let PublicSurveyFlowService = PublicSurveyFlowService_1 = class PublicSurveyFlowService {
    constructor(surveys, responses, dataSource, correo) {
        this.surveys = surveys;
        this.responses = responses;
        this.dataSource = dataSource;
        this.correo = correo;
        this.logger = new common_1.Logger(PublicSurveyFlowService_1.name);
    }
    async activa(surveyId) {
        const survey = await this.surveys.findOne({ where: { id: surveyId } });
        if (!survey || survey.status !== 'active')
            throw new common_1.NotFoundException('La encuesta no está disponible');
        await (0, encuestas_de_la_empresa_1.encuestaPublicaDisponible)(this.surveys, survey.clientId);
        return survey;
    }
    async quienResponde(survey, invitacion) {
        const leida = (0, invitacion_a_encuesta_1.leerInvitacion)(invitacion, survey.id, secretoDeInvitaciones());
        if (!leida)
            return null;
        const filas = await this.dataSource.query('SELECT id, organization_id, client_id, guest_name, guest_email FROM reservations WHERE id = ? LIMIT 1', [leida.reservationId]);
        const reserva = filas[0];
        if (!reserva || reserva.organization_id !== survey.organizationId)
            return null;
        if (survey.clientId && reserva.client_id !== survey.clientId)
            return null;
        return { reservationId: reserva.id, nombre: reserva.guest_name, correo: reserva.guest_email };
    }
    async iniciar(surveyId, rating, invitacion, origen) {
        const survey = await this.activa(surveyId);
        const pregunta = (0, flujo_de_encuesta_1.preguntaDeNota)(survey.questions ?? []);
        if (!pregunta)
            throw new common_1.BadRequestException('Esta encuesta no empieza con una nota');
        if (!(0, flujo_de_encuesta_1.notaValida)(rating))
            throw new common_1.BadRequestException('La nota tiene que ser de 1 a 5 estrellas');
        const persona = await this.quienResponde(survey, invitacion);
        const token = (0, node_crypto_1.randomBytes)(24).toString('base64url');
        const tokenHash = hashDelToken(token);
        const respuesta = await this.dataSource.transaction(async (manager) => {
            const previa = persona
                ? await manager.findOne(survey_response_entity_1.SurveyResponse, { where: { surveyId: survey.id, reservationId: persona.reservationId } })
                : null;
            if (previa) {
                await manager.update(survey_response_entity_1.SurveyResponse, { id: previa.id }, {
                    rating,
                    answers: { ...(previa.answers ?? {}), [pregunta.id]: rating },
                    editTokenHash: tokenHash,
                });
                return { ...previa, rating };
            }
            const nueva = await manager.save(manager.create(survey_response_entity_1.SurveyResponse, {
                organizationId: survey.organizationId,
                surveyId: survey.id,
                respondentId: persona
                    ? `reserva:${persona.reservationId}`
                    : `public:${(origen?.trim() || 'link').slice(0, 40)}:${(0, node_crypto_1.randomUUID)()}`.slice(0, 100),
                answers: { [pregunta.id]: rating },
                rating,
                reservationId: persona?.reservationId ?? null,
                respondentName: persona?.nombre ?? null,
                respondentEmail: persona?.correo ?? null,
                editTokenHash: tokenHash,
            }));
            await manager.increment(survey_entity_1.Survey, { id: survey.id }, 'responseCount', 1);
            return nueva;
        });
        return {
            responseId: respuesta.id,
            token,
            rating,
            siguiente: (0, flujo_de_encuesta_1.siguientePaso)(rating, Number(survey.googleReview?.minRating)),
            reviewUrl: urlDeResena(String(survey.googleReview?.url || '')),
            nombre: persona?.nombre ? persona.nombre.trim().split(/\s+/)[0] : null,
        };
    }
    async completar(surveyId, responseId, token, datos) {
        const survey = await this.activa(surveyId);
        const respuesta = await this.responses
            .createQueryBuilder('r')
            .addSelect('r.editTokenHash')
            .where('r.id = :id AND r.surveyId = :surveyId', { id: responseId, surveyId: survey.id })
            .getOne();
        if (!respuesta)
            throw new common_1.NotFoundException('No encontramos esa respuesta');
        const esperado = Buffer.from(respuesta.editTokenHash || '');
        const recibido = Buffer.from(hashDelToken(token || ''));
        if (!respuesta.editTokenHash || esperado.length !== recibido.length || !(0, node_crypto_1.timingSafeEqual)(esperado, recibido)) {
            throw new common_1.ForbiddenException('No se puede modificar esta respuesta');
        }
        let respuestas;
        try {
            respuestas = (0, flujo_de_encuesta_1.unirRespuestas)(survey.questions ?? [], respuesta.answers ?? {}, datos.answers);
        }
        catch (error) {
            throw new common_1.BadRequestException(error instanceof Error ? error.message : 'Respuesta inválida');
        }
        if (datos.responder && datos.terminar) {
            const faltan = (0, flujo_de_encuesta_1.obligatoriasPendientes)(survey.questions ?? [], respuestas);
            if (faltan.length > 0)
                throw new common_1.BadRequestException(`Faltan respuestas: ${faltan.join(', ')}`);
        }
        const nota = (0, flujo_de_encuesta_1.preguntaDeNota)(survey.questions ?? []);
        const malFormados = (0, shared_1.problemasDeRespuesta)((survey.questions ?? []).map((pregunta) => ({ ...pregunta, required: false })), respuestas, nota ? [nota.id] : []);
        if (malFormados.length > 0)
            throw new common_1.BadRequestException(malFormados.join(' · '));
        let aceptacion = {};
        try {
            aceptacion = await (0, consentimiento_de_encuesta_1.aceptacionAGuardar)(this.dataSource, survey, respuestas, datos.aceptaPrivacidad || Boolean(respuesta.privacyConsentAt));
        }
        catch (error) {
            throw new common_1.BadRequestException(error instanceof Error ? error.message : 'Falta aceptar el uso de tus datos');
        }
        const escrito = (0, consentimiento_de_encuesta_1.contactoEscrito)(survey.questions ?? [], respuestas);
        if (respuesta.privacyConsentAt)
            aceptacion = {};
        const mensaje = typeof datos.teamMessage === 'string' ? datos.teamMessage.trim().slice(0, flujo_de_encuesta_1.LARGO_MAXIMO_MENSAJE) : undefined;
        const mensajeNuevo = Boolean(mensaje) && mensaje !== (respuesta.teamMessage ?? '').trim();
        await this.responses.update({ id: respuesta.id }, {
            answers: respuestas,
            ...aceptacion,
            ...(!respuesta.respondentName && escrito.nombre ? { respondentName: escrito.nombre } : {}),
            ...(!respuesta.respondentEmail && escrito.correo ? { respondentEmail: escrito.correo } : {}),
            ...(mensaje !== undefined ? { teamMessage: mensaje || null } : {}),
            ...(datos.terminar ? { completedAt: new Date() } : {}),
        });
        if (mensajeNuevo && mensaje) {
            void this.avisarAlEquipo(survey, { ...respuesta, teamMessage: mensaje }).catch((error) => {
                this.logger.warn(`No se pudo avisar al equipo del mensaje de la respuesta ${respuesta.id}: ${error instanceof Error ? error.message : error}`);
            });
        }
        return { completed: Boolean(datos.terminar) };
    }
    async avisarAlEquipo(survey, respuesta) {
        if (!respuesta.reservationId)
            return;
        const filas = await this.dataSource.query(`SELECT f.name, f.team_notifications, f.design_config
         FROM reservations r JOIN reservation_forms f ON f.id = r.form_id
        WHERE r.id = ? AND r.organization_id = ? LIMIT 1`, [respuesta.reservationId, survey.organizationId]);
        const local = filas[0];
        if (!local)
            return;
        const parsear = (valor) => {
            if (typeof valor !== 'string')
                return valor;
            try {
                return JSON.parse(valor);
            }
            catch {
                return undefined;
            }
        };
        const equipo = parsear(local.team_notifications);
        const diseno = parsear(local.design_config);
        const destinatarios = new Set((Array.isArray(equipo) ? equipo : []).filter((correo) => typeof correo === 'string' && correo.includes('@')));
        if (destinatarios.size === 0 && typeof diseno?.supportEmail === 'string' && diseno.supportEmail.includes('@')) {
            destinatarios.add(diseno.supportEmail);
        }
        if (destinatarios.size === 0)
            return;
        const quien = respuesta.respondentName?.trim() || 'Una persona que los visitó';
        const html = (0, plantilla_de_correo_1.armazonDeCorreo)(`${quien} les dejó un mensaje`, `Calificó su visita a ${local.name} con ${respuesta.rating ?? '—'} de 5 y quiso contarles esto antes de publicar nada:\n\n«${respuesta.teamMessage}»${respuesta.respondentEmail ? '\n\nPueden responderle directo a este correo.' : ''}`, undefined, undefined, [
            { etiqueta: 'Encuesta', valor: survey.title },
            { etiqueta: 'Nota', valor: `${respuesta.rating ?? '—'} de 5` },
            ...(respuesta.respondentEmail ? [{ etiqueta: 'Correo', valor: respuesta.respondentEmail }] : []),
        ]);
        for (const destino of destinatarios) {
            await this.correo.send(destino, `Mensaje de ${quien} sobre su visita`, html, respuesta.respondentEmail ? { replyTo: respuesta.respondentEmail } : undefined);
        }
    }
};
exports.PublicSurveyFlowService = PublicSurveyFlowService;
exports.PublicSurveyFlowService = PublicSurveyFlowService = PublicSurveyFlowService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(survey_entity_1.Survey)),
    __param(1, (0, typeorm_1.InjectRepository)(survey_response_entity_1.SurveyResponse)),
    __param(2, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        email_service_1.EmailService])
], PublicSurveyFlowService);
