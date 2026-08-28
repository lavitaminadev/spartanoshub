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
exports.CrmHomeController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const module_scope_decorator_1 = require("../../../core/authorization/module-scope.decorator");
const crm_home_service_1 = require("./crm-home.service");
const lead_visibility_1 = require("./lead-visibility");
const client_capability_service_1 = require("../../../core/client-scope/client-capability.service");
const crm_dashboard_service_1 = require("./crm-dashboard.service");
const account_access_service_1 = require("../../../core/client-scope/account-access.service");
const user_role_enum_1 = require("../../organizations/user-role.enum");
let CrmHomeController = class CrmHomeController {
    constructor(home, dashboard, accountAccess, capacidades) {
        this.home = home;
        this.dashboard = dashboard;
        this.accountAccess = accountAccess;
        this.capacidades = capacidades;
    }
    async assertPortalCrm(req) {
        if (req.user.role !== user_role_enum_1.UserRole.CLIENT)
            return;
        if (!req.user.clientId)
            throw new common_1.ForbiddenException('La cuenta cliente no está asociada a una empresa');
        await this.capacidades.assert(req.organizationId, req.user.clientId, 'crm');
    }
    async get(req, coolingDays, domain, clientId) {
        await this.assertPortalCrm(req);
        const effectiveClientId = req.user.role === user_role_enum_1.UserRole.CLIENT ? req.user.clientId : clientId;
        const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        const agencyOnly = (domain === undefined || domain === 'commercial')
            && !effectiveClientId
            && allowedClientIds === undefined;
        const dias = Math.min(Math.max(Number(coolingDays) || 7, 1), 90);
        await this.accountAccess.assertClient(req.organizationId, req.user, effectiveClientId);
        await this.capacidades.assert(req.organizationId, effectiveClientId, 'crm');
        const conCrm = !effectiveClientId && !agencyOnly
            ? await this.capacidades.filtrar(req.organizationId, allowedClientIds, 'crm')
            : allowedClientIds;
        return this.home.home(req.organizationId, dias, {
            domain: domain === 'audience' ? 'audience' : 'commercial',
            clientId: effectiveClientId || undefined,
            agencyOnly,
            ocultarEquipo: req.user.role === user_role_enum_1.UserRole.CLIENT,
            allowedClientIds: conCrm,
            onlyAssignedTo: (0, lead_visibility_1.veSoloLoSuyo)(req.user.role, req.user.crmProfile) ? req.user.id : undefined,
        });
    }
    async panel(req, days, domain, clientId) {
        await this.assertPortalCrm(req);
        const effectiveClientId = req.user.role === user_role_enum_1.UserRole.CLIENT ? req.user.clientId : clientId;
        const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        const agencyOnly = (domain === undefined || domain === 'commercial')
            && !effectiveClientId
            && allowedClientIds === undefined;
        const ventana = Math.min(Math.max(Number(days) || 30, 1), 365);
        await this.accountAccess.assertClient(req.organizationId, req.user, effectiveClientId);
        await this.capacidades.assert(req.organizationId, effectiveClientId, 'crm');
        const conCrm = !effectiveClientId && !agencyOnly
            ? await this.capacidades.filtrar(req.organizationId, allowedClientIds, 'crm')
            : allowedClientIds;
        return this.dashboard.dashboard(req.organizationId, ventana, {
            domain: domain === 'audience' ? 'audience' : 'commercial',
            clientId: effectiveClientId || undefined,
            agencyOnly,
            allowedClientIds: conCrm,
            onlyAssignedTo: (0, lead_visibility_1.veSoloLoSuyo)(req.user.role, req.user.crmProfile) ? req.user.id : undefined,
        });
    }
};
exports.CrmHomeController = CrmHomeController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Avisos y carga del equipo al entrar al CRM' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('coolingDays')),
    __param(2, (0, common_1.Query)('domain')),
    __param(3, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CrmHomeController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, swagger_1.ApiOperation)({ summary: 'Cifras del embudo comercial' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('days')),
    __param(2, (0, common_1.Query)('domain')),
    __param(3, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CrmHomeController.prototype, "panel", null);
exports.CrmHomeController = CrmHomeController = __decorate([
    (0, common_1.Controller)('crm/home'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('crm'),
    __metadata("design:paramtypes", [crm_home_service_1.CrmHomeService,
        crm_dashboard_service_1.CrmDashboardService,
        account_access_service_1.AccountAccessService,
        client_capability_service_1.ClientCapabilityService])
], CrmHomeController);
