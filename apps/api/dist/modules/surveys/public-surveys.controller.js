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
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const node_crypto_1 = require("node:crypto");
const public_decorator_1 = require("../../core/auth/decorators/public.decorator");
const survey_entity_1 = require("./survey.entity");
const survey_response_entity_1 = require("./survey-response.entity");
const survey_dto_1 = require("./dto/survey.dto");
function publicSurveyUrl(id) {
    const publicOrigin = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
    return publicOrigin ? `${publicOrigin}/survey/${encodeURIComponent(id)}` : undefined;
}
let PublicSurveysController = class PublicSurveysController {
    constructor(surveys, responses) {
        this.surveys = surveys;
        this.responses = responses;
    }
    toContract(survey) {
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
        };
    }
    async detail(id) {
        const survey = await this.surveys.findOne({ where: { id } });
        if (!survey || survey.status !== 'active')
            throw new common_1.NotFoundException('La encuesta no está disponible');
        return this.toContract(survey);
    }
    async submit(id, dto) {
        const survey = await this.surveys.findOne({ where: { id } });
        if (!survey || survey.status !== 'active')
            throw new common_1.NotFoundException('La encuesta no está disponible');
        const known = new Set((survey.questions ?? []).map((question) => question.id));
        const unknown = Object.keys(dto.answers ?? {}).filter((key) => !known.has(key));
        if (unknown.length > 0)
            throw new common_1.BadRequestException(`La encuesta no tiene las preguntas: ${unknown.join(', ')}`);
        const missing = (survey.questions ?? [])
            .filter((question) => question.required)
            .filter((question) => {
            const value = dto.answers?.[question.id];
            return value === undefined || value === null || value === '';
        });
        if (missing.length > 0)
            throw new common_1.BadRequestException('Faltan respuestas obligatorias');
        const saved = await this.responses.manager.transaction(async (manager) => {
            const response = await manager.save(manager.create(survey_response_entity_1.SurveyResponse, {
                organizationId: survey.organizationId,
                surveyId: survey.id,
                respondentId: `public:${(dto.respondentId?.trim() || 'link').slice(0, 40)}:${(0, node_crypto_1.randomUUID)()}`.slice(0, 100),
                answers: dto.answers ?? {},
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
        typeorm_2.Repository])
], PublicSurveysController);
