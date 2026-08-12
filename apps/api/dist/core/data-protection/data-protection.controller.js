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
exports.DataProtectionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const data_protection_service_1 = require("./data-protection.service");
const auth_guard_1 = require("../auth/auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const roles_decorator_1 = require("../authorization/roles.decorator");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const record_consent_dto_1 = require("./dto/record-consent.dto");
const module_scope_decorator_1 = require("../authorization/module-scope.decorator");
let DataProtectionController = class DataProtectionController {
    constructor(service) {
        this.service = service;
    }
    async exportMyData(user) {
        return this.service.exportUserData(user.id);
    }
    async anonymizeMe(user) {
        await this.service.anonymizeUser(user.id);
        return { message: 'Datos anonimizados correctamente' };
    }
    async recordConsent(user, body, req) {
        return this.service.recordConsent(user.id, body.action, body.granted, req.ip);
    }
    async exportLeadData(id, req) {
        return this.service.exportLeadData(id, req.organizationId);
    }
    async anonymizeLead(id, req) {
        return this.service.anonymizeLead(id, req.organizationId, 'Solicitud manual de anonimizacion');
    }
    async anonymizeContact(id, req) {
        return this.service.anonymizeContact(id, req.organizationId, 'Solicitud manual de anonimizacion');
    }
    async anonymizeReservation(id, req) {
        return this.service.anonymizeReservation(id, req.organizationId, 'Solicitud manual de anonimizacion');
    }
};
exports.DataProtectionController = DataProtectionController;
__decorate([
    (0, common_1.Get)('export'),
    (0, swagger_1.ApiOperation)({ summary: 'Exportar mis datos personales (Ley 19.628)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DataProtectionController.prototype, "exportMyData", null);
__decorate([
    (0, common_1.Delete)('anonymize'),
    (0, swagger_1.ApiOperation)({ summary: 'Anonimizar mis datos personales' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DataProtectionController.prototype, "anonymizeMe", null);
__decorate([
    (0, common_1.Post)('consent'),
    (0, swagger_1.ApiOperation)({ summary: 'Registrar consentimiento de datos' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, record_consent_dto_1.RecordConsentDto, Object]),
    __metadata("design:returntype", Promise)
], DataProtectionController.prototype, "recordConsent", null);
__decorate([
    (0, common_1.Get)('leads/:id/export'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Exportar datos de un lead para revision o cumplimiento' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DataProtectionController.prototype, "exportLeadData", null);
__decorate([
    (0, common_1.Delete)('leads/:id/anonymize'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Anonimizar un lead individual' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DataProtectionController.prototype, "anonymizeLead", null);
__decorate([
    (0, common_1.Delete)('contacts/:id/anonymize'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Anonimizar un contacto de campana a peticion del titular' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DataProtectionController.prototype, "anonymizeContact", null);
__decorate([
    (0, common_1.Delete)('reservations/:id/anonymize'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Anonimizar los datos del comensal de una reserva' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DataProtectionController.prototype, "anonymizeReservation", null);
exports.DataProtectionController = DataProtectionController = __decorate([
    (0, swagger_1.ApiTags)('Proteccion de Datos'),
    (0, common_1.Controller)('data-protection'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)(...Object.values(user_role_enum_1.UserRole)),
    (0, module_scope_decorator_1.ModuleScope)('governance'),
    __metadata("design:paramtypes", [data_protection_service_1.DataProtectionService])
], DataProtectionController);
//# sourceMappingURL=data-protection.controller.js.map