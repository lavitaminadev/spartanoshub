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
exports.IntakeController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const requires_permission_decorator_1 = require("../../core/authorization/requires-permission.decorator");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
const account_access_service_1 = require("../../core/client-scope/account-access.service");
const user_role_enum_1 = require("../organizations/user-role.enum");
const intake_service_1 = require("./intake.service");
const work_request_dto_1 = require("./dto/work-request.dto");
const work_request_entity_1 = require("./work-request.entity");
let IntakeController = class IntakeController {
    constructor(intake, accountAccess) {
        this.intake = intake;
        this.accountAccess = accountAccess;
    }
    async clientScope(req) {
        if (intake_service_1.AREA_SCOPED_ROLES.has(req.user.role))
            return undefined;
        return this.accountAccess.allowedClientIds(req.organizationId, req.user);
    }
    async create(req, dto) {
        const allowed = await this.clientScope(req);
        return this.intake.create(req.organizationId, req.user.id, dto, allowed);
    }
    async list(req, status, area, clientId, mine) {
        const allowed = await this.clientScope(req);
        return this.intake.list(req.organizationId, { status, area, clientId, mine: mine === 'true' ? req.user.id : undefined }, allowed, { id: req.user.id, role: req.user.role });
    }
    async counts(req) {
        const allowed = await this.clientScope(req);
        return this.intake.counts(req.organizationId, allowed, { id: req.user.id, role: req.user.role });
    }
    async assignees(req, area) {
        if (!Object.values(work_request_entity_1.WorkRequestArea).includes(area)) {
            throw new common_1.BadRequestException('Indica un área válida');
        }
        return this.intake.assigneeOptions(req.organizationId, area);
    }
    async findOne(req, id) {
        const allowed = await this.clientScope(req);
        return this.intake.findOne(req.organizationId, id, allowed);
    }
    async update(req, id, dto) {
        const allowed = await this.clientScope(req);
        return this.intake.update(req.organizationId, id, dto, allowed);
    }
    async convert(req, id, dto) {
        const allowed = await this.clientScope(req);
        return this.intake.convert(req.organizationId, id, dto, allowed);
    }
};
exports.IntakeController = IntakeController;
__decorate([
    (0, common_1.Post)(),
    (0, requires_permission_decorator_1.RequiresPermission)('intake', 'view'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL, user_role_enum_1.UserRole.AI_LEAD),
    (0, swagger_1.ApiOperation)({ summary: 'Abrir una solicitud de trabajo' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, work_request_dto_1.CreateWorkRequestDto]),
    __metadata("design:returntype", Promise)
], IntakeController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, requires_permission_decorator_1.RequiresPermission)('intake', 'view'),
    (0, swagger_1.ApiOperation)({ summary: 'Bandeja de solicitudes' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('area')),
    __param(3, (0, common_1.Query)('clientId')),
    __param(4, (0, common_1.Query)('mine')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], IntakeController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('counts'),
    (0, requires_permission_decorator_1.RequiresPermission)('intake', 'view'),
    (0, swagger_1.ApiOperation)({ summary: 'Conteo de solicitudes por estado' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IntakeController.prototype, "counts", null);
__decorate([
    (0, common_1.Get)('options/assignees'),
    (0, requires_permission_decorator_1.RequiresPermission)('intake', 'view'),
    (0, swagger_1.ApiOperation)({ summary: 'Responsables activos del área indicada' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('area')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], IntakeController.prototype, "assignees", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, requires_permission_decorator_1.RequiresPermission)('intake', 'view'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], IntakeController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, requires_permission_decorator_1.RequiresPermission)('intake', 'manage'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Asignar responsable, prioridad o estado' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, work_request_dto_1.UpdateWorkRequestDto]),
    __metadata("design:returntype", Promise)
], IntakeController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/convert'),
    (0, requires_permission_decorator_1.RequiresPermission)('intake', 'manage'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Convertir la solicitud en piezas de produccion' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, work_request_dto_1.ResolveWorkRequestDto]),
    __metadata("design:returntype", Promise)
], IntakeController.prototype, "convert", null);
exports.IntakeController = IntakeController = __decorate([
    (0, swagger_1.ApiTags)('Solicitudes'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('intake/requests'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, module_scope_decorator_1.ModuleScope)('intake'),
    __metadata("design:paramtypes", [intake_service_1.IntakeService,
        account_access_service_1.AccountAccessService])
], IntakeController);
