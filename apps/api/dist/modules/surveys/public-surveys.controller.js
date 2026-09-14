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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicSurveysController = void 0;
const common_1 = require("@nestjs/common");
const encuestas_de_la_empresa_1 = require("./encuestas-de-la-empresa");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const node_crypto_1 = require("node:crypto");
const public_decorator_1 = require("../../core/auth/decorators/public.decorator");
const survey_entity_1 = require("./survey.entity");
const survey_response_entity_1 = require("./survey-response.entity");
const survey_dto_1 = require("./dto/survey.dto");
const public_survey_flow_service_1 = require("./public-survey-flow.service");
const shared_1 = require("@espartanos/shared");
const consentimiento_de_encuesta_1 = require("./consentimiento-de-encuesta");
function publicSurveyUrl(id) {
    const publicOrigin = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
    return publicOrigin ? `${publicOrigin}/survey/${encodeURIComponent(id)}` : undefined;
}
let PublicSurveysController = class PublicSurveysController {
    constructor(surveys, responses, flujo) {
        this.surveys = surveys;
        this.responses = responses;
        this.flujo = flujo;
    }
    async start(id, dto) {
        return this.flujo.iniciar(id, dto.rating, dto.invitacion, dto.origen);
    }
    async complete(id, responseId, dto) {
        return this.flujo.completar(id, responseId, dto.token, dto);
    }
    async toContract(survey) {
        return {
            id: survey.id,
            title: survey.title,
            type: survey.type,
            questions: survey.questions ?? [],
            status: survey.status,
            publicUrl: publicSurveyUrl(survey.id),
            ga4MeasurementId: survey.ga4MeasurementId ?? null,
            designConfig: survey.designConfig ?? undefined,
            googleReview: survey.googleReview ?? undefined,
            consentimiento: await (0, consentimiento_de_encuesta_1.consentimientoDeEncuesta)(this.surveys.manager, survey),
        };
    }
    async visit(id, dto) {
        const survey = await this.surveys.findOne({ where: { id } });
        if (!survey || survey.status !== 'active')
            return { registrada: false };
        await this.surveys.manager.query('INSERT IGNORE INTO survey_visits (id, organization_id, survey_id, origen, session_id) VALUES (?, ?, ?, ?, ?)', [(0, node_crypto_1.randomUUID)(), survey.organizationId, survey.id, (dto.origen || 'link').slice(0, 60), dto.sesion]).catch(() => undefined);
        return { registrada: true };
    }
    async detail(id) {
        const survey = await this.surveys.findOne({ where: { id } });
        if (!survey || survey.status !== 'active')
            throw new common_1.NotFoundException('La encuesta no está disponible');
        await (0, encuestas_de_la_empresa_1.encuestaPublicaDisponible)(this.surveys, survey.clientId);
        return this.toContract(survey);
    }
    async submit(id, dto) {
        const survey = await this.surveys.findOne({ where: { id } });
        if (!survey || survey.status !== 'active')
            throw new common_1.NotFoundException('La encuesta no está disponible');
        await (0, encuestas_de_la_empresa_1.encuestaPublicaDisponible)(this.surveys, survey.clientId);
        const known = new Set((survey.questions ?? []).map((question) => question.id));
        const unknown = Object.keys(dto.answers ?? {}).filter((key) => !known.has(key));
        if (unknown.length > 0)
            throw new common_1.BadRequestException(`La encuesta no tiene las preguntas: ${unknown.join(', ')}`);
        const problemas = (0, shared_1.problemasDeRespuesta)(survey.questions ?? [], dto.answers ?? {});
        if (problemas.length > 0)
            throw new common_1.BadRequestException(problemas.join(' · '));
        let aceptacion;
        try {
            aceptacion = await (0, consentimiento_de_encuesta_1.aceptacionAGuardar)(this.surveys.manager, survey, dto.answers ?? {}, dto.aceptaPrivacidad);
        }
        catch (error) {
            throw new common_1.BadRequestException(error instanceof Error ? error.message : 'Falta aceptar el uso de tus datos');
        }
        const escrito = (0, consentimiento_de_encuesta_1.contactoEscrito)(survey.questions ?? [], dto.answers ?? {});
        const saved = await this.responses.manager.transaction(async (manager) => {
            const response = await manager.save(manager.create(survey_response_entity_1.SurveyResponse, {
                organizationId: survey.organizationId,
                surveyId: survey.id,
                respondentId: `public:${(dto.respondentId?.trim() || 'link').slice(0, 40)}:${(0, node_crypto_1.randomUUID)()}`.slice(0, 100),
                answers: dto.answers ?? {},
                respondentName: escrito.nombre ?? null,
                respondentEmail: escrito.correo ?? null,
                ...aceptacion,
            }));
            await manager.increment(survey_entity_1.Survey, { id: survey.id }, 'responseCount', 1);
            return response;
        });
        return {
            surveyId: saved.surveyId,
            respondentId: saved.respondentId,
            answers: saved.answers,
            submittedAt: saved.submittedAt.toISOString(),
        };
    }
};
exports.PublicSurveysController = PublicSurveysController;
__decorate([
    (0, common_1.Post)(':id/start'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, survey_dto_1.StartSurveyResponseDto]),
    __metadata("design:returntype", Promise)
], PublicSurveysController.prototype, "start", null);
__decorate([
    (0, common_1.Post)(':id/responses/:responseId/complete'),
    (0, throttler_1.Throttle)({ default: { limit: 20, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('responseId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, survey_dto_1.CompleteSurveyResponseDto]),
    __metadata("design:returntype", Promise)
], PublicSurveysController.prototype, "complete", null);
__decorate([
    (0, common_1.Post)(':id/visit'),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, survey_dto_1.SurveyVisitDto]),
    __metadata("design:returntype", Promise)
], PublicSurveysController.prototype, "visit", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, throttler_1.Throttle)({ default: { limit: 60, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PublicSurveysController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(':id/responses'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, survey_dto_1.SubmitSurveyResponseDto]),
    __metadata("design:returntype", Promise)
], PublicSurveysController.prototype, "submit", null);
exports.PublicSurveysController = PublicSurveysController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiTags)('Encuestas públicas'),
    (0, common_1.Controller)('public/surveys'),
    __param(0, (0, typeorm_1.InjectRepository)(survey_entity_1.Survey)),
    __param(1, (0, typeorm_1.InjectRepository)(survey_response_entity_1.SurveyResponse)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        public_survey_flow_service_1.PublicSurveyFlowService])
], PublicSurveysController);
