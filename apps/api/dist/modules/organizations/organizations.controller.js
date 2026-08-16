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
exports.OrganizationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const create_organization_use_case_1 = require("./create-organization.use-case");
const list_organizations_use_case_1 = require("./list-organizations.use-case");
const create_organization_dto_1 = require("./dto/create-organization.dto");
const update_organization_dto_1 = require("./dto/update-organization.dto");
const update_organization_features_dto_1 = require("./dto/update-organization-features.dto");
const organization_entity_1 = require("./organization.entity");
const organization_features_1 = require("./organization-features");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const feature_guard_1 = require("../../core/authorization/feature.guard");
const audit_service_1 = require("../../core/audit/audit.service");
const user_role_enum_1 = require("./user-role.enum");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
const permission_resolver_service_1 = require("../../core/authorization/permission-resolver.service");
let OrganizationsController = class OrganizationsController {
    constructor(createOrg, listOrgs, organizations, featureGuard, permissionResolver, audit) {
        this.createOrg = createOrg;
        this.listOrgs = listOrgs;
        this.organizations = organizations;
        this.featureGuard = featureGuard;
        this.permissionResolver = permissionResolver;
        this.audit = audit;
    }
    create(dto) {
        return this.createOrg.execute(dto);
    }
    list(req) {
        return this.listOrgs.execute(req.organizationId || req.user.organizationId);
    }
    updateProfile(req, dto) {
        const organizationId = req.organizationId || req.user.organizationId;
        return this.createOrg.executeUpdate(organizationId, dto);
    }
    async features(req) {
        const organizationId = req.organizationId || req.user.organizationId;
        const organization = await this.organizations.findOne({ where: { id: organizationId }, select: ['id', 'features'] });
        return { features: (0, organization_features_1.normalizeOrganizationFeatures)(organization?.features) };
    }
    async updateFeatures(req, dto) {
        const organizationId = req.organizationId || req.user.organizationId;
        const unknownKeys = update_organization_features_dto_1.UpdateOrganizationFeaturesDto.validateKeys(dto.features);
        if (unknownKeys.length > 0) {
            throw new common_1.BadRequestException(`Módulos desconocidos: ${unknownKeys.join(', ')}. Válidos: ${update_organization_features_dto_1.UpdateOrganizationFeaturesDto.allowedKeys.join(', ')}`);
        }
        const requiredDisabled = organization_features_1.REQUIRED_ORGANIZATION_FEATURE_KEYS.filter((key) => dto.features[key] === false);
        if (requiredDisabled.length > 0) {
            throw new common_1.BadRequestException(`No se pueden desactivar módulos esenciales: ${requiredDisabled.join(', ')}`);
        }
        const organization = await this.organizations.findOne({ where: { id: organizationId } });
        if (!organization)
            throw new common_1.NotFoundException('Organización no encontrada');
        const features = (0, organization_features_1.normalizeOrganizationFeatures)({ ...organization.features, ...dto.features });
        await this.organizations.update(organizationId, { features });
        this.featureGuard.invalidate(organizationId);
        this.permissionResolver.invalidateOrganization(organizationId);
        await this.audit.log({
            organizationId,
            actorId: req.user?.id,
            entityType: 'Organization',
            entityId: organizationId,
            action: 'updated',
            before: { features: organization.features },
            after: { features },
        });
        return { features };
    }
};
exports.OrganizationsController = OrganizationsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Crear una organización' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_organization_dto_1.CreateOrganizationDto]),
    __metadata("design:returntype", void 0)
], OrganizationsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar organizaciones' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrganizationsController.prototype, "list", null);
__decorate([
    (0, common_1.Put)('profile'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar perfil de la organización' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_organization_dto_1.UpdateOrganizationDto]),
    __metadata("design:returntype", void 0)
], OrganizationsController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Get)('features'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Módulos habilitados de la organización' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrganizationsController.prototype, "features", null);
__decorate([
    (0, common_1.Put)('features'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.DEV),
    (0, swagger_1.ApiOperation)({ summary: 'Habilitar o deshabilitar módulos de la organización' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_organization_features_dto_1.UpdateOrganizationFeaturesDto]),
    __metadata("design:returntype", Promise)
], OrganizationsController.prototype, "updateFeatures", null);
exports.OrganizationsController = OrganizationsController = __decorate([
    (0, swagger_1.ApiTags)('Organizaciones'),
    (0, common_1.Controller)('organizations'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, module_scope_decorator_1.ModuleScope)('settings'),
    __param(2, (0, typeorm_1.InjectRepository)(organization_entity_1.Organization)),
    __metadata("design:paramtypes", [create_organization_use_case_1.CreateOrganizationUseCase,
        list_organizations_use_case_1.ListOrganizationsUseCase,
        typeorm_2.Repository,
        feature_guard_1.FeatureGuard,
        permission_resolver_service_1.PermissionResolverService,
        audit_service_1.AuditService])
], OrganizationsController);
