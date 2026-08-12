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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const health_service_1 = require("./health.service");
const integrations_health_service_1 = require("./integrations-health.service");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const roles_decorator_1 = require("../authorization/roles.decorator");
const module_scope_decorator_1 = require("../authorization/module-scope.decorator");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
let HealthController = class HealthController {
    constructor(health, integrationsHealth) {
        this.health = health;
        this.integrationsHealth = integrationsHealth;
    }
    async check(res) {
        const result = await this.health.check();
        res.status(result.status === 'ok' ? 200 : 503);
        return { status: result.status, timestamp: result.timestamp, version: result.version };
    }
    async details(res) {
        const result = await this.health.check();
        res.status(result.status === 'ok' ? 200 : 503);
        return result;
    }
    async db() {
        return this.health.checkDb();
    }
    async integrations() {
        return this.integrationsHealth.checkAll();
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Sonda de disponibilidad pública' }),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "check", null);
__decorate([
    (0, common_1.Get)('details'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Diagnóstico detallado del sistema' }),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "details", null);
__decorate([
    (0, common_1.Get)('db'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Health check de base de datos' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "db", null);
__decorate([
    (0, common_1.Get)('integrations'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Health check de integraciones' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "integrations", null);
exports.HealthController = HealthController = __decorate([
    (0, swagger_1.ApiTags)('Health'),
    (0, common_1.Controller)('health'),
    (0, module_scope_decorator_1.ModuleExempt)('Sondas de disponibilidad y diagnostico, acotadas por cargo con @Roles'),
    __metadata("design:paramtypes", [health_service_1.HealthService,
        integrations_health_service_1.IntegrationsHealthService])
], HealthController);
//# sourceMappingURL=health.controller.js.map