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
exports.StageLabelsController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const lead_entity_1 = require("./lead.entity");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const module_scope_decorator_1 = require("../../../core/authorization/module-scope.decorator");
const roles_decorator_1 = require("../../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../../organizations/user-role.enum");
const account_access_service_1 = require("../../../core/client-scope/account-access.service");
const stage_labels_service_1 = require("./stage-labels.service");
let StageLabelsController = class StageLabelsController {
    constructor(rotulos, accountAccess, leads) {
        this.rotulos = rotulos;
        this.accountAccess = accountAccess;
        this.leads = leads;
    }
    async get(req, clientId) {
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        return { labels: await this.rotulos.get(req.organizationId, clientId ?? null) };
    }
    async vocabulario(req, clientId) {
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        return { labels: await this.rotulos.get(req.organizationId, clientId ?? null, stage_labels_service_1.CLAVE_VOCABULARIO) };
    }
    async guardarVocabulario(req, cuerpo, clientId) {
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        return {
            labels: await this.rotulos.set(req.organizationId, clientId ?? null, cuerpo?.labels ?? {}, stage_labels_service_1.CLAVE_VOCABULARIO),
        };
    }
    async put(req, cuerpo, clientId) {
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        return { labels: await this.rotulos.set(req.organizationId, clientId ?? null, cuerpo?.labels ?? {}) };
    }
    async ocultas(req, clientId) {
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        return { hidden: await this.rotulos.ocultas(req.organizationId, clientId ?? null) };
    }
    async guardarOcultas(req, cuerpo, clientId) {
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        const pedidas = cuerpo?.hidden ?? [];
        const yaOcultas = await this.rotulos.ocultas(req.organizationId, clientId ?? null);
        for (const estado of pedidas.filter((etapa) => !yaOcultas.includes(etapa))) {
            const dentro = await this.leads.count({
                where: {
                    organizationId: req.organizationId,
                    status: estado,
                    clientId: clientId ?? (0, typeorm_2.IsNull)(),
                },
            });
            if (dentro > 0) {
                throw new common_1.BadRequestException(`No se puede ocultar esa etapa: hay ${dentro} ${dentro === 1 ? "lead" : "leads"} dentro. `
                    + 'Muévelos primero y vuelve a intentarlo.');
            }
        }
        return { hidden: await this.rotulos.ocultar(req.organizationId, clientId ?? null, pedidas) };
    }
};
exports.StageLabelsController = StageLabelsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Rótulos de etapa de una empresa' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], StageLabelsController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('vocabulary'),
    (0, swagger_1.ApiOperation)({ summary: 'Vocabulario del CRM de una empresa' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], StageLabelsController.prototype, "vocabulario", null);
__decorate([
    (0, common_1.Put)('vocabulary'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.DEV, user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Renombrar las cosas del CRM de una empresa' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], StageLabelsController.prototype, "guardarVocabulario", null);
__decorate([
    (0, common_1.Put)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.DEV, user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Renombrar las etapas de una empresa' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], StageLabelsController.prototype, "put", null);
__decorate([
    (0, common_1.Get)('hidden'),
    (0, swagger_1.ApiOperation)({ summary: 'Etapas ocultas de una empresa' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], StageLabelsController.prototype, "ocultas", null);
__decorate([
    (0, common_1.Put)('hidden'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.DEV, user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Elegir qué etapas usa una empresa' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], StageLabelsController.prototype, "guardarOcultas", null);
exports.StageLabelsController = StageLabelsController = __decorate([
    (0, common_1.Controller)('crm/stage-labels'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('crm'),
    __param(2, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __metadata("design:paramtypes", [stage_labels_service_1.StageLabelsService,
        account_access_service_1.AccountAccessService,
        typeorm_2.Repository])
], StageLabelsController);
