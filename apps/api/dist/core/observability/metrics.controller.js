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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const roles_guard_1 = require("../authorization/roles.guard");
const roles_decorator_1 = require("../authorization/roles.decorator");
const metrics_service_1 = require("./metrics.service");
const module_scope_decorator_1 = require("../authorization/module-scope.decorator");
let MetricsController = class MetricsController {
    constructor(metrics) {
        this.metrics = metrics;
    }
    getMetrics() {
        return this.metrics.getMetrics();
    }
};
exports.MetricsController = MetricsController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('admin'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener métricas del sistema (solo admin)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MetricsController.prototype, "getMetrics", null);
exports.MetricsController = MetricsController = __decorate([
    (0, swagger_1.ApiTags)('Métricas'),
    (0, common_1.Controller)('metrics'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt'), roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleExempt)('Sonda de operacion consumida por el monitoreo, no por la aplicacion'),
    __metadata("design:paramtypes", [metrics_service_1.MetricsService])
], MetricsController);
