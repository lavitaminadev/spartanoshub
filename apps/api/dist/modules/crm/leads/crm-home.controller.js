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
const crm_dashboard_service_1 = require("./crm-dashboard.service");
const account_access_service_1 = require("../../../core/client-scope/account-access.service");
let CrmHomeController = class CrmHomeController {
    constructor(home, dashboard, accountAccess) {
        this.home = home;
        this.dashboard = dashboard;
        this.accountAccess = accountAccess;
    }
    async get(req, coolingDays, domain, clientId) {
        const dias = Math.min(Math.max(Number(coolingDays) || 7, 1), 90);
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        return this.home.home(req.organizationId, dias, {
            domain: domain === 'audience' ? 'audience' : 'commercial',
            clientId: clientId || undefined,
            onlyAssignedTo: (0, lead_visibility_1.veSoloLoSuyo)(req.user.role) ? req.user.id : undefined,
        });
    }
    async panel(req, days, domain, clientId) {
        const ventana = Math.min(Math.max(Number(days) || 30, 1), 365);
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        return this.dashboard.dashboard(req.organizationId, ventana, {
            domain: domain === 'audience' ? 'audience' : 'commercial',
            clientId: clientId || undefined,
            onlyAssignedTo: (0, lead_visibility_1.veSoloLoSuyo)(req.user.role) ? req.user.id : undefined,
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
        account_access_service_1.AccountAccessService])
], CrmHomeController);
