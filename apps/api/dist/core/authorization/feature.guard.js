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
var FeatureGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const requires_feature_decorator_1 = require("./requires-feature.decorator");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const organization_entity_1 = require("../../modules/organizations/organization.entity");
const organization_features_1 = require("../../modules/organizations/organization-features");
let FeatureGuard = FeatureGuard_1 = class FeatureGuard {
    constructor(reflector, organizations) {
        this.reflector = reflector;
        this.organizations = organizations;
        this.cache = new Map();
    }
    async canActivate(context) {
        if (this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]))
            return true;
        const required = this.reflector.getAllAndOverride(requires_feature_decorator_1.REQUIRES_FEATURE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!required)
            return true;
        const request = context.switchToHttp().getRequest();
        const organizationId = request.organizationId ?? request.user?.organizationId;
        if (!organizationId)
            throw new common_1.ForbiddenException('No se pudo determinar la organización de la petición');
        const features = await this.featuresOf(organizationId);
        if (!features[required])
            throw new common_1.ForbiddenException('Este módulo no está habilitado para tu organización');
        return true;
    }
    async featuresOf(organizationId) {
        const cached = this.cache.get(organizationId);
        if (cached && cached.expiresAt > Date.now())
            return cached.features;
        const organization = await this.organizations.findOne({ where: { id: organizationId }, select: ['id', 'features'] });
        const features = organization
            ? (0, organization_features_1.normalizeOrganizationFeatures)(organization.features)
            : organization_features_1.DEFAULT_ORGANIZATION_FEATURES;
        this.cache.set(organizationId, { features, expiresAt: Date.now() + FeatureGuard_1.CACHE_TTL_MS });
        return features;
    }
    invalidate(organizationId) {
        this.cache.delete(organizationId);
    }
};
exports.FeatureGuard = FeatureGuard;
FeatureGuard.CACHE_TTL_MS = 30_000;
exports.FeatureGuard = FeatureGuard = FeatureGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(organization_entity_1.Organization)),
    __metadata("design:paramtypes", [core_1.Reflector,
        typeorm_2.Repository])
], FeatureGuard);
