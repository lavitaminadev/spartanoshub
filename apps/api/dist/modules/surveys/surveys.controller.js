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
exports.SurveysController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const shared_1 = require("@espartanos/shared");
const passport_1 = require("@nestjs/passport");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const survey_entity_1 = require("./survey.entity");
const survey_response_entity_1 = require("./survey-response.entity");
const survey_dto_1 = require("./dto/survey.dto");
function publicSurveyUrl(id) {
    const publicOrigin = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
    return publicOrigin ? `${publicOrigin}/survey/${encodeURIComponent(id)}` : undefined;
}
let SurveysController = class SurveysController {
    constructor(surveys, responses, dataSource) {
        this.surveys = surveys;
        this.responses = responses;
        this.dataSource = dataSource;
    }
    toContract(survey) {
        return {
            id: survey.id,
            title: survey.title,
            type: survey.type,
            questions: survey.questions ?? [],
            status: survey.status,
            createdAt: survey.createdAt.toISOString(),
            createdBy: survey.createdBy,
            recipients: survey.recipients ?? undefined,
            distribution: survey.distribution ?? undefined,
            publicUrl: publicSurveyUrl(survey.id),
            ga4MeasurementId: survey.ga4MeasurementId ?? null,
            responses: survey.responseCount,
            designConfig: survey.designConfig ?? undefined,
            googleReview: survey.googleReview ?? undefined,
        };
    }
    async findOwned(id, organizationId) {
        const survey = await this.surveys.findOne({ where: { id, organizationId } });
        if (!survey)
            throw new common_1.NotFoundException('La encuesta no existe');
        return survey;
    }
    async list(req) {
        const rows = await this.surveys.find({
            where: { organizationId: req.organizationId },
            order: { createdAt: 'DESC' },
        });
        return rows.map((row) => this.toContract(row));
    }
    async detail(req, id) {
        return this.toContract(await this.findOwned(id, req.organizationId));
    }
    async create(req, dto) {
        this.assertUniqueQuestionIds(dto.questions);
        const saved = await this.surveys.save(this.surveys.create({
            organizationId: req.organizationId,
            title: dto.title,
            type: dto.type,
            questions: dto.questions,
            status: 'draft',
            createdBy: req.user.id,
            recipients: dto.recipients ?? null,
            distribution: dto.distribution ?? null,
            ga4MeasurementId: dto.ga4MeasurementId?.trim() || null,
            responseCount: 0,
            designConfig: dto.designConfig ?? null,
            googleReview: dto.googleReview ?? null,
        }));
        return this.toContract(saved);
    }
    async update(req, id, dto) {
        const survey = await this.findOwned(id, req.organizationId);
        if (dto.questions) {
            this.assertUniqueQuestionIds(dto.questions);
            if (survey.responseCount > 0) {
                throw new common_1.BadRequestException('No se pueden cambiar las preguntas de una encuesta que ya tiene respuestas');
            }
            survey.questions = dto.questions;
        }
        if (dto.title !== undefined)
            survey.title = dto.title;
        if (dto.type !== undefined)
            survey.type = dto.type;
        if (dto.status !== undefined)
            survey.status = dto.status;
        if (dto.recipients !== undefined)
            survey.recipients = dto.recipients;
        if (dto.distribution !== undefined)
            survey.distribution = dto.distribution;
        if (dto.ga4MeasurementId !== undefined)
            survey.ga4MeasurementId = dto.ga4MeasurementId?.trim() || null;
        if (dto.designConfig !== undefined)
            survey.designConfig = dto.designConfig;
        if (dto.googleReview !== undefined)
            survey.googleReview = dto.googleReview;
        return this.toContract(await this.surveys.save(survey));
    }
    async remove(req, id) {
        const survey = await this.findOwned(id, req.organizationId);
        await this.dataSource.transaction(async (manager) => {
            await manager.delete(survey_response_entity_1.SurveyResponse, { surveyId: survey.id });
            await manager.remove(survey);
        });
        return { removed: true };
    }
    async results(req, id) {
        const survey = await this.findOwned(id, req.organizationId);
        const rows = await this.responses.find({ where: { surveyId: survey.id }, order: { submittedAt: 'ASC' } });
        const responses = rows.map((row) => ({
            surveyId: row.surveyId,
            respondentId: row.respondentId,
            answers: row.answers ?? {},
            submittedAt: row.submittedAt.toISOString(),
        }));
        return (0, shared_1.computeSurveyResults)(this.toContract(survey), responses);
    }
    async submit(req, id, dto) {
        const survey = await this.findOwned(id, req.organizationId);
        if (survey.status !== 'active')
            throw new common_1.BadRequestException('La encuesta no está recibiendo respuestas');
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
        const saved = await this.dataSource.transaction(async (manager) => {
            const response = await manager.save(manager.create(survey_response_entity_1.SurveyResponse, {
                organizationId: req.organizationId,
                surveyId: survey.id,
                respondentId: dto.respondentId?.trim() || req.user.id,
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
    assertUniqueQuestionIds(questions) {
        const ids = questions.map((question) => question.id);
        if (new Set(ids).size !== ids.length) {
            throw new common_1.BadRequestException('Cada pregunta debe tener un identificador distinto');
        }
    }
};
exports.SurveysController = SurveysController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Listar encuestas' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SurveysController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Leer una encuesta' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SurveysController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Crear una encuesta' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, survey_dto_1.CreateSurveyDto]),
    __metadata("design:returntype", Promise)
], SurveysController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar una encuesta' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, survey_dto_1.UpdateSurveyDto]),
    __metadata("design:returntype", Promise)
], SurveysController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Eliminar una encuesta' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SurveysController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/results'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Resultados agregados de una encuesta' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SurveysController.prototype, "results", null);
__decorate([
    (0, common_1.Post)(':id/responses'),
    (0, roles_decorator_1.Roles)(...Object.values(user_role_enum_1.UserRole)),
    (0, swagger_1.ApiOperation)({ summary: 'Registrar una respuesta' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, survey_dto_1.SubmitSurveyResponseDto]),
    __metadata("design:returntype", Promise)
], SurveysController.prototype, "submit", null);
exports.SurveysController = SurveysController = __decorate([
    (0, swagger_1.ApiTags)('Encuestas'),
    (0, common_1.Controller)('surveys'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('surveys'),
    __param(0, (0, typeorm_1.InjectRepository)(survey_entity_1.Survey)),
    __param(1, (0, typeorm_1.InjectRepository)(survey_response_entity_1.SurveyResponse)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], SurveysController);
