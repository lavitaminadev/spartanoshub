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
const shared_1 = require("@espartanos/shared");
const typeorm_2 = require("typeorm");
const organization_entity_1 = require("../../modules/organizations/organization.entity");
const organization_features_1 = require("../../modules/organizations/organization-features");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const user_permission_override_entity_1 = require("./user-permission-override.entity");
const role_permission_override_entity_1 = require("./role-permission-override.entity");
const permission_level_1 = require("./permission-level");
const role_permissions_1 = require("./role-permissions");
const parameter_resolver_service_1 = require("../parameters/parameter-resolver.service");
function cellKey(role, module) {
    return `${role}:${module}`;
}
let PermissionResolverService = PermissionResolverService_1 = class PermissionResolverService {
    constructor(organizations, overrides, roleOverrides, parameters) {
        this.organizations = organizations;
        this.overrides = overrides;
        this.roleOverrides = roleOverrides;
        this.parameters = parameters;
        this.cache = new Map();
        this.roleOverrideCache = new Map();
    }
    async permissionsFor(organizationId, userId, role) {
        const cacheKey = `${organizationId}:${userId}:${role}`;
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now())
            return cached.permissions;
        const [features, lifecycleMap, overrides, roleLevels] = await Promise.all([
            this.featuresOf(organizationId),
            this.lifecycleOf(organizationId),
            this.overrides.find({ where: { organizationId, userId } }),
            this.roleLevelsOf(organizationId),
        ]);
        const overrideByModule = this.activeOverrides(overrides);
        const permissions = Object.fromEntries(organization_features_1.ORGANIZATION_FEATURE_KEYS.map((module) => [
            module,
            (0, shared_1.isModuleLifecycleVisible)(lifecycleMap[module]) && features[module]
                ? overrideByModule.get(module)?.level ?? roleLevels.get(cellKey(role, module)) ?? (0, role_permissions_1.roleLevel)(role, module)
                : 'none',
        ]));
        this.cache.set(cacheKey, { permissions, expiresAt: Date.now() + PermissionResolverService_1.CACHE_TTL_MS });
        return permissions;
    }
    async explain(organizationId, userId, role) {
        const [features, lifecycleMap, overrides, roleLevels] = await Promise.all([
            this.featuresOf(organizationId),
            this.lifecycleOf(organizationId),
            this.overrides.find({ where: { organizationId, userId } }),
            this.roleLevelsOf(organizationId),
        ]);
        const overrideByModule = this.activeOverrides(overrides);
        return organization_features_1.ORGANIZATION_FEATURE_KEYS.map((module) => {
            const override = overrideByModule.get(module);
            const adjusted = roleLevels.get(cellKey(role, module));
            const moduleDisabled = !features[module];
            const productHidden = !(0, shared_1.isModuleLifecycleVisible)(lifecycleMap[module]);
            const base = adjusted ?? (0, role_permissions_1.roleLevel)(role, module);
            return {
                module,
                level: productHidden || moduleDisabled ? 'none' : override?.level ?? base,
                source: override ? 'override' : 'role',
                roleAdjusted: adjusted !== undefined,
                moduleDisabled,
                productHidden,
            };
        });
    }
    async roleMatrix(organizationId) {
        const roleLevels = await this.roleLevelsOf(organizationId);
        const matrix = {};
        const sources = {};
        for (const module of organization_features_1.ORGANIZATION_FEATURE_KEYS) {
            matrix[module] = {};
            sources[module] = {};
            for (const role of Object.values(user_role_enum_1.UserRole)) {
                const adjusted = roleLevels.get(cellKey(role, module));
                matrix[module][role] = adjusted ?? (0, role_permissions_1.roleLevel)(role, module);
                sources[module][role] = adjusted === undefined ? 'code' : 'override';
            }
        }
        return { matrix, sources };
    }
    codeLevel(role, module) {
        return (0, role_permissions_1.roleLevel)(role, module);
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
        this.roleOverrideCache.delete(organizationId);
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${organizationId}:`))
                this.cache.delete(key);
        }
    }
    activeOverrides(overrides) {
        const now = Date.now();
        const result = new Map();
        for (const item of overrides) {
            if (item.expiresAt && item.expiresAt.getTime() <= now)
                continue;
            result.set(item.module, item);
        }
        return result;
    }
    async roleLevelsOf(organizationId) {
        const cached = this.roleOverrideCache.get(organizationId);
        if (cached && cached.expiresAt > Date.now())
            return cached.levels;
        const rows = await this.roleOverrides.find({ where: { organizationId } });
        const levels = new Map(rows.map((row) => [cellKey(row.role, row.module), row.level]));
        this.roleOverrideCache.set(organizationId, {
            levels,
            expiresAt: Date.now() + PermissionResolverService_1.CACHE_TTL_MS,
        });
        return levels;
    }
    async featuresOf(organizationId) {
        const organization = await this.organizations.findOne({
            where: { id: organizationId },
            select: ['id', 'features'],
        });
        return (0, organization_features_1.normalizeOrganizationFeatures)(organization?.features);
    }
    async lifecycleOf(organizationId) {
        const defaults = (0, shared_1.buildDefaultOrganizationModuleLifecycleMap)();
        const parameters = this.parameters;
        if (!parameters)
            return defaults;
        const configured = await Promise.all(organization_features_1.ORGANIZATION_FEATURE_KEYS.map(async (module) => {
            const value = await parameters.get((0, shared_1.moduleLifecycleSettingKey)(module), null, null, organizationId);
            return [module, value];
        }));
        for (const [module, value] of configured) {
            if (typeof value === 'string')
                defaults[module] = value;
        }
        return defaults;
    }
};
exports.PermissionResolverService = PermissionResolverService;
PermissionResolverService.CACHE_TTL_MS = 30_000;
exports.PermissionResolverService = PermissionResolverService = PermissionResolverService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(organization_entity_1.Organization)),
    __param(1, (0, typeorm_1.InjectRepository)(user_permission_override_entity_1.UserPermissionOverride)),
    __param(2, (0, typeorm_1.InjectRepository)(role_permission_override_entity_1.RolePermissionOverride)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        parameter_resolver_service_1.ParameterResolver])
], PermissionResolverService);
