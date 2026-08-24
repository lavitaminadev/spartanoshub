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
var PermissionGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const requires_permission_decorator_1 = require("./requires-permission.decorator");
const module_scope_decorator_1 = require("./module-scope.decorator");
const requires_feature_decorator_1 = require("./requires-feature.decorator");
const permission_resolver_service_1 = require("./permission-resolver.service");
const shared_1 = require("@espartanos/shared");
const LEVEL_BY_METHOD = {
    GET: 'view',
    HEAD: 'view',
    OPTIONS: 'view',
    POST: 'edit',
    PUT: 'edit',
    PATCH: 'edit',
    DELETE: 'manage',
};
let PermissionGuard = PermissionGuard_1 = class PermissionGuard {
    constructor(reflector, permissions) {
        this.reflector = reflector;
        this.permissions = permissions;
        this.logger = new common_1.Logger(PermissionGuard_1.name);
    }
    async canActivate(context) {
        const targets = [context.getHandler(), context.getClass()];
        if (this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, targets))
            return true;
        if (this.reflector.getAllAndOverride(module_scope_decorator_1.MODULE_EXEMPT_KEY, targets))
            return true;
        const request = context.switchToHttp().getRequest();
        const organizationId = request.organizationId ?? request.user?.organizationId;
        const user = request.user;
        if (!organizationId || !user?.id || !user?.role) {
            throw new common_1.ForbiddenException('No se pudo determinar el usuario o la organización de la petición');
        }
        const required = this.resolveRequirement(context, targets);
        if (!required) {
            this.logger.error(`Endpoint sin módulo declarado: ${request.method} ${request.url}`);
            throw new common_1.ForbiddenException('Este endpoint no tiene módulo declarado');
        }
        if (!(0, shared_1.isModuleInInitialOperationScope)(required.module, user.role)) {
            throw new common_1.ForbiddenException('Este módulo aún no está disponible en la operación');
        }
        const allowed = await this.permissions.can(organizationId, user.id, user.role, required.module, required.level);
        if (!allowed)
            throw new common_1.ForbiddenException('No tienes acceso a este módulo');
        return true;
    }
    resolveRequirement(context, targets) {
        const explicit = this.reflector.getAllAndOverride(requires_permission_decorator_1.REQUIRES_PERMISSION_KEY, targets);
        if (explicit)
            return explicit;
        const module = this.reflector.getAllAndOverride(module_scope_decorator_1.MODULE_SCOPE_KEY, targets)
            ?? this.reflector.getAllAndOverride(requires_feature_decorator_1.REQUIRES_FEATURE_KEY, targets);
        if (!module)
            return undefined;
        const method = context.switchToHttp().getRequest().method;
        return { module, level: LEVEL_BY_METHOD[method] ?? 'manage' };
    }
};
exports.PermissionGuard = PermissionGuard;
exports.PermissionGuard = PermissionGuard = PermissionGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        permission_resolver_service_1.PermissionResolverService])
], PermissionGuard);
