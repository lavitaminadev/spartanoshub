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
exports.SurveysController = exports.MAXIMO_ENVIO_POR_PEDIDO = void 0;
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
const account_access_service_1 = require("../../core/client-scope/account-access.service");
const email_service_1 = require("../../core/notifications/email.service");
const plantilla_de_correo_1 = require("../../core/notifications/plantilla-de-correo");
const encuestas_de_la_empresa_1 = require("./encuestas-de-la-empresa");
const typeorm_3 = require("typeorm");
const requiere_accion_1 = require("../../core/authorization/requiere-accion");
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
exports.MAXIMO_ENVIO_POR_PEDIDO = 500;
function publicSurveyUrl(id) {
    const publicOrigin = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
    return publicOrigin ? `${publicOrigin}/survey/${encodeURIComponent(id)}` : undefined;
}
let SurveysController = class SurveysController {
    constructor(surveys, responses, dataSource, accountAccess, correo) {
        this.surveys = surveys;
        this.responses = responses;
        this.dataSource = dataSource;
        this.accountAccess = accountAccess;
        this.correo = correo;
    }
    toContract(survey) {
        return {
            id: survey.id,
            clientId: survey.clientId ?? undefined,
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
    async findOwned(id, req) {
        const survey = await this.surveys.findOne({ where: { id, organizationId: req.organizationId } });
        if (!survey)
            throw new common_1.NotFoundException('La encuesta no existe');
        if (req.user.role === user_role_enum_1.UserRole.CLIENT) {
            if (!survey.clientId || survey.clientId !== req.user.clientId)
                throw new common_1.NotFoundException('La encuesta no existe');
            await (0, encuestas_de_la_empresa_1.exigirEncuestasHabilitadas)(this.dataSource, survey.clientId);
        }
        if (survey.clientId) {
            const permitidas = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
            if (permitidas !== undefined && !permitidas.includes(survey.clientId))
                throw new common_1.NotFoundException('La encuesta no existe');
        }
        return survey;
    }
    async list(req, clientId) {
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        const permitidas = clientId ? undefined : await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        if (req.user.role === user_role_enum_1.UserRole.CLIENT) {
            if (!req.user.clientId)
                return [];
            await (0, encuestas_de_la_empresa_1.exigirEncuestasHabilitadas)(this.dataSource, req.user.clientId);
            const propias = await this.surveys.find({ where: { organizationId: req.organizationId, clientId: req.user.clientId }, order: { createdAt: 'DESC' } });
            return propias.map((row) => this.toContract(row));
        }
        const where = clientId
            ? { organizationId: req.organizationId, clientId }
            : permitidas === undefined
                ? { organizationId: req.organizationId }
                : [{ organizationId: req.organizationId, clientId: (0, typeorm_3.IsNull)() }, ...(permitidas.length ? [{ organizationId: req.organizationId, clientId: (0, typeorm_3.In)(permitidas) }] : [])];
        const rows = await this.surveys.find({ where, order: { createdAt: 'DESC' } });
        return rows.map((row) => this.toContract(row));
    }
    async detail(req, id) {
        return this.toContract(await this.findOwned(id, req));
    }
    async create(req, dto) {
        if (dto.type === 'customer' && !dto.clientId)
            throw new common_1.BadRequestException('Las encuestas de clientes requieren una empresa');
        if (dto.type === 'internal' && dto.clientId)
            throw new common_1.BadRequestException('Las encuestas internas no se asignan a una empresa');
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
        await (0, encuestas_de_la_empresa_1.exigirEncuestasHabilitadas)(this.dataSource, dto.clientId);
        this.assertUniqueQuestionIds(dto.questions);
        const saved = await this.surveys.save(this.surveys.create({
            organizationId: req.organizationId,
            clientId: dto.clientId ?? null,
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
        const survey = await this.findOwned(id, req);
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
        if (dto.clientId !== undefined) {
            await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
            survey.clientId = dto.clientId;
        }
        if (dto.clientId !== undefined || dto.status === 'active')
            await (0, encuestas_de_la_empresa_1.exigirEncuestasHabilitadas)(this.dataSource, survey.clientId);
        if (survey.type === 'customer' && !survey.clientId)
            throw new common_1.BadRequestException('Las encuestas de clientes requieren una empresa');
        if (survey.type === 'internal' && survey.clientId)
            throw new common_1.BadRequestException('Las encuestas internas no se asignan a una empresa');
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
        const survey = await this.findOwned(id, req);
        await this.dataSource.transaction(async (manager) => {
            await manager.delete(survey_response_entity_1.SurveyResponse, { surveyId: survey.id });
            await manager.remove(survey);
        });
        return { removed: true };
    }
    async results(req, id) {
        const survey = await this.findOwned(id, req);
        const rows = await this.responses.find({ where: { surveyId: survey.id }, order: { submittedAt: 'ASC' } });
        const responses = rows.map((row) => ({
            surveyId: row.surveyId,
            respondentId: row.respondentId,
            answers: row.answers ?? {},
            submittedAt: row.submittedAt.toISOString(),
        }));
        const detalle = rows.slice().reverse().slice(0, 500).map((row) => ({
            id: row.id,
            submittedAt: row.submittedAt.toISOString(),
            rating: row.rating ?? null,
            respondentName: row.respondentName ?? null,
            respondentEmail: row.respondentEmail ?? null,
            reservationId: row.reservationId ?? null,
            teamMessage: row.teamMessage ?? null,
            completedAt: row.completedAt ? row.completedAt.toISOString() : null,
            answers: row.answers ?? {},
        }));
        return { ...(0, shared_1.computeSurveyResults)(this.toContract(survey), responses), respuestas: detalle };
    }
    async submit(req, id, dto) {
        const survey = await this.findOwned(id, req);
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
    async sendEmail(req, id) {
        const survey = await this.findOwned(id, req);
        await (0, encuestas_de_la_empresa_1.exigirEncuestasHabilitadas)(this.dataSource, survey.clientId);
        if (survey.status !== 'active')
            throw new common_1.BadRequestException('Activa la encuesta antes de enviarla');
        if (!(survey.distribution ?? []).includes('email'))
            throw new common_1.BadRequestException('Esta encuesta no tiene el correo habilitado como canal');
        const base = publicSurveyUrl(survey.id);
        if (!base)
            throw new common_1.BadRequestException('Falta configurar la dirección pública de la aplicación');
        const unicos = [...new Set((survey.recipients ?? []).map((correo) => correo.trim().toLowerCase()))];
        const validos = unicos.filter((correo) => CORREO.test(correo));
        const invalidos = unicos.length - validos.length;
        if (validos.length === 0)
            throw new common_1.BadRequestException('La encuesta no tiene destinatarios con un correo válido');
        if (validos.length > exports.MAXIMO_ENVIO_POR_PEDIDO) {
            throw new common_1.BadRequestException(`Son ${validos.length} destinatarios; el máximo por envío es ${exports.MAXIMO_ENVIO_POR_PEDIDO}.`);
        }
        const enlace = `${base}?src=email`;
        const html = (0, plantilla_de_correo_1.armazonDeCorreo)(survey.title, survey.designConfig?.welcome || 'Nos gustaría saber tu opinión. Es un minuto.', { texto: 'Responder la encuesta', url: enlace });
        let enviados = 0;
        let fallidos = 0;
        for (const destino of validos) {
            const ok = await this.correo.send(destino, survey.title, html).catch(() => false);
            if (ok)
                enviados += 1;
            else
                fallidos += 1;
        }
        return { enviados, fallidos, invalidos };
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
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Listar encuestas' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SurveysController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
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
    (0, requiere_accion_1.RequiereAccion)('surveys.borrar'),
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
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
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
__decorate([
    (0, common_1.Post)(':id/send-email'),
    (0, requiere_accion_1.RequiereAccion)('surveys.enviar'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Enviar la encuesta por correo a sus destinatarios' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SurveysController.prototype, "sendEmail", null);
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
        typeorm_2.DataSource,
        account_access_service_1.AccountAccessService,
        email_service_1.EmailService])
], SurveysController);
