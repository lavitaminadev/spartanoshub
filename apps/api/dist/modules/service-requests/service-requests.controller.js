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
exports.ServiceRequestsController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@espartanos/shared");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const requires_permission_decorator_1 = require("../../core/authorization/requires-permission.decorator");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
const public_decorator_1 = require("../../core/auth/decorators/public.decorator");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const service_requests_service_1 = require("./service-requests.service");
const service_request_dto_1 = require("./dto/service-request.dto");
const user_role_enum_1 = require("../organizations/user-role.enum");
let ServiceRequestsController = class ServiceRequestsController {
    constructor(service) {
        this.service = service;
    }
    assertCanalDisponible() {
        if ((0, shared_1.isOrganizationModuleVisible)('governance'))
            return;
        throw new common_1.ServiceUnavailableException('El canal de solicitudes no está disponible por ahora. Escribe a la agencia para ejercer tus derechos sobre datos personales.');
    }
    agencyOrganizationId() {
        const id = process.env.AGENCY_ORGANIZATION_ID;
        if (!id) {
            throw new common_1.ServiceUnavailableException('El canal de solicitudes no está configurado. Escribe a la agencia para ejercer tus derechos sobre datos personales.');
        }
        return id;
    }
    async privacy() {
        this.assertCanalDisponible();
        return this.service.avisoPrivacidad(this.agencyOrganizationId());
    }
    async create(dto) {
        this.assertCanalDisponible();
        if (dto.website)
            return { id: 'spam', status: 'ignored' };
        return this.service.createPublic({
            type: dto.type,
            requesterName: dto.requesterName,
            requesterEmail: dto.requesterEmail,
            requesterRut: dto.requesterRut,
            requesterPhone: dto.requesterPhone,
            message: dto.message,
            privacyAccepted: dto.privacyAccepted,
            organizationId: this.agencyOrganizationId(),
        });
    }
    status(ref) {
        this.assertCanalDisponible();
        return this.service.findByReference(ref ?? '');
    }
    list(req, status, type) {
        return this.service.list(req.organizationId, { status, type });
    }
    getOne(req, id) {
        return this.service.getOne(req.organizationId, id);
    }
    update(req, id, dto) {
        return this.service.update(req.organizationId, id, { id: req.user.id, name: req.user.name }, dto);
    }
    anonymize(req, id) {
        return this.service.anonymizeByIdentity(req.organizationId, id, { id: req.user.id, name: req.user.name });
    }
};
exports.ServiceRequestsController = ServiceRequestsController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('privacy'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ServiceRequestsController.prototype, "privacy", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [service_request_dto_1.CreateServiceRequestDto]),
    __metadata("design:returntype", Promise)
], ServiceRequestsController.prototype, "create", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('status'),
    __param(0, (0, common_1.Query)('ref')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ServiceRequestsController.prototype, "status", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, requires_permission_decorator_1.RequiresPermission)('settings', 'view'),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ServiceRequestsController.prototype, "list", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, requires_permission_decorator_1.RequiresPermission)('settings', 'view'),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ServiceRequestsController.prototype, "getOne", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, requires_permission_decorator_1.RequiresPermission)('settings', 'edit'),
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, service_request_dto_1.UpdateServiceRequestDto]),
    __metadata("design:returntype", void 0)
], ServiceRequestsController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, requires_permission_decorator_1.RequiresPermission)('settings', 'manage'),
    (0, common_1.Post)(':id/anonymize'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ServiceRequestsController.prototype, "anonymize", null);
exports.ServiceRequestsController = ServiceRequestsController = __decorate([
    (0, swagger_1.ApiTags)('Solicitudes'),
    (0, common_1.Controller)('service-requests'),
    (0, module_scope_decorator_1.ModuleScope)('settings'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.DEV),
    __metadata("design:paramtypes", [service_requests_service_1.ServiceRequestsService])
], ServiceRequestsController);
