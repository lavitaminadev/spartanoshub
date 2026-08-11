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
var PermissionResolverService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionResolverService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const organization_entity_1 = require("../../modules/organizations/organization.entity");
const organization_features_1 = require("../../modules/organizations/organization-features");
const user_permission_override_entity_1 = require("./user-permission-override.entity");
const permission_level_1 = require("./permission-level");
const role_permissions_1 = require("./role-permissions");
let PermissionResolverService = PermissionResolverService_1 = class PermissionResolverService {
    constructor(organizations, overrides) {
        this.organizations = organizations;
        this.overrides = overrides;
        this.cache = new Map();
    }
    async permissionsFor(organizationId, userId, role) {
        const cacheKey = `${organizationId}:${userId}:${role}`;
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now())
            return cached.permissions;
        const [features, overrides] = await Promise.all([
            this.featuresOf(organizationId),
            this.overrides.find({ where: { organizationId, userId } }),
        ]);
        const overrideByModule = new Map(overrides.map((item) => [item.module, item.level]));
        const permissions = Object.fromEntries(organization_features_1.ORGANIZATION_FEATURE_KEYS.map((module) => [
            module,
            features[module] ? overrideByModule.get(module) ?? (0, role_permissions_1.roleLevel)(role, module) : 'none',
        ]));
        this.cache.set(cacheKey, { permissions, expiresAt: Date.now() + PermissionResolverService_1.CACHE_TTL_MS });
        return permissions;
    }
    async explain(organizationId, userId, role) {
        const [features, overrides] = await Promise.all([
            this.featuresOf(organizationId),
            this.overrides.find({ where: { organizationId, userId } }),
        ]);
        const overrideByModule = new Map(overrides.map((item) => [item.module, item.level]));
        return organization_features_1.ORGANIZATION_FEATURE_KEYS.map((module) => {
            const override = overrideByModule.get(module);
            const moduleDisabled = !features[module];
            return {
                module,
                level: moduleDisabled ? 'none' : override ?? (0, role_permissions_1.roleLevel)(role, module),
                source: override ? 'override' : 'role',
                moduleDisabled,
            };
        });
    }
    async can(organizationId, userId, role, module, required) {
        if (!(0, organization_features_1.isOrganizationFeatureKey)(module))
            return false;
        const permissions = await this.permissionsFor(organizationId, userId, role);
        return (0, permission_level_1.satisfies)(permissions[module], required);
    }
    invalidateUser(userId) {
        for (const key of this.cache.keys()) {
            if (key.includes(`:${userId}:`))
                this.cache.delete(key);
        }
    }
    invalidateOrganization(organizationId) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${organizationId}:`))
                this.cache.delete(key);
        }
    }
    async featuresOf(organizationId) {
        const organization = await this.organizations.findOne({
            where: { id: organizationId },
            select: ['id', 'features'],
        });
        return (0, organization_features_1.normalizeOrganizationFeatures)(organization?.features);
    }
};
exports.PermissionResolverService = PermissionResolverService;
PermissionResolverService.CACHE_TTL_MS = 30_000;
exports.PermissionResolverService = PermissionResolverService = PermissionResolverService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(organization_entity_1.Organization)),
    __param(1, (0, typeorm_1.InjectRepository)(user_permission_override_entity_1.UserPermissionOverride)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], PermissionResolverService);
//# sourceMappingURL=permission-resolver.service.js.map