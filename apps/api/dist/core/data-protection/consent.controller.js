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
exports.ConsentController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const auth_guard_1 = require("../auth/auth.guard");
const roles_decorator_1 = require("../authorization/roles.decorator");
const module_scope_decorator_1 = require("../authorization/module-scope.decorator");
const requires_permission_decorator_1 = require("../authorization/requires-permission.decorator");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const user_entity_1 = require("../../modules/users/user.entity");
const audit_service_1 = require("../audit/audit.service");
const organization_settings_service_1 = require("../parameters/organization-settings.service");
const parameter_resolver_service_1 = require("../parameters/parameter-resolver.service");
const consent_version_entity_1 = require("./consent-version.entity");
const publish_consent_version_dto_1 = require("./dto/publish-consent-version.dto");
function versionTag(version) {
    return `v${version}`;
}
function versionNumber(tag) {
    const match = /^v(\d+)$/.exec(tag ?? '');
    return match ? Number(match[1]) : null;
}
let ConsentController = class ConsentController {
    constructor(versions, users, settings, parameters, audit, dataSource) {
        this.versions = versions;
        this.users = users;
        this.settings = settings;
        this.parameters = parameters;
        this.audit = audit;
        this.dataSource = dataSource;
    }
    async active(req) {
        const version = await this.versions.findOne({
            where: { organizationId: req.organizationId, active: true },
            order: { version: 'DESC' },
        });
        return version ?? null;
    }
    async list(req) {
        const items = await this.versions.find({
            where: { organizationId: req.organizationId },
            order: { version: 'DESC' },
        });
        return { data: items };
    }
    async publish(req, dto) {
        const title = dto.title?.trim();
        const text = dto.text?.trim();
        if (!title || !text)
            throw new common_1.BadRequestException('El título y el texto del consentimiento son obligatorios');
        const saved = await this.dataSource.transaction(async (manager) => {
            const last = await manager.findOne(consent_version_entity_1.ConsentVersion, {
                where: { organizationId: req.organizationId },
                order: { version: 'DESC' },
            });
            const next = (last?.version ?? 0) + 1;
            await manager.update(consent_version_entity_1.ConsentVersion, { organizationId: req.organizationId, active: true }, { active: false });
            const created = await manager.save(manager.create(consent_version_entity_1.ConsentVersion, {
                organizationId: req.organizationId,
                version: next,
                title,
                text,
                publishedBy: req.user.id,
                active: true,
            }));
            await this.settings.update(req.organizationId, req.user.id, {
                'compliance.terms_version': versionTag(next),
            });
            return created;
        });
        await this.audit.log({
            organizationId: req.organizationId,
            actorId: req.user.id,
            entityType: 'ConsentVersion',
            entityId: saved.id,
            action: 'published',
            after: { version: saved.version, title: saved.title },
        });
        return saved;
    }
    async byUser(req) {
        const current = String(await this.parameters.get('compliance.terms_version', null, null, req.organizationId) ?? '');
        const people = await this.users.find({
            where: { organizationId: req.organizationId },
            select: { id: true, name: true, termsVersion: true, termsAcceptedAt: true },
            order: { name: 'ASC' },
        });
        return {
            data: people.map((person) => ({
                userId: person.id,
                userName: person.name,
                acceptedVersion: versionNumber(person.termsVersion),
                acceptedAt: person.termsAcceptedAt ? person.termsAcceptedAt.toISOString() : undefined,
                status: !person.termsAcceptedAt
                    ? 'pending'
                    : current && person.termsVersion !== current
                        ? 'expired'
                        : 'accepted',
            })),
        };
    }
    async pendingCount(req) {
        const current = String(await this.parameters.get('compliance.terms_version', null, null, req.organizationId) ?? '');
        const people = await this.users.find({
            where: { organizationId: req.organizationId },
            select: { id: true, termsVersion: true, termsAcceptedAt: true },
        });
        const pending = people.filter((person) => !person.termsAcceptedAt || (current && person.termsVersion !== current));
        return { pending: pending.length, total: people.length };
    }
    async grant(req, id) {
        const person = await this.users.findOne({ where: { id, organizationId: req.organizationId } });
        if (!person)
            throw new common_1.NotFoundException('La persona no existe en esta organización');
        const current = String(await this.parameters.get('compliance.terms_version', null, null, req.organizationId) ?? '');
        const before = { termsVersion: person.termsVersion, termsAcceptedAt: person.termsAcceptedAt };
        await this.users.update(id, { termsVersion: current || person.termsVersion, termsAcceptedAt: new Date() });
        await this.audit.log({
            organizationId: req.organizationId,
            actorId: req.user.id,
            entityType: 'User',
            entityId: id,
            action: 'consent_granted_without_acceptance',
            before,
            after: { termsVersion: current },
            reason: 'Acceso otorgado por administración sin aceptación de la persona',
            ipAddress: req.ip,
        });
        return { granted: true, version: current };
    }
};
exports.ConsentController = ConsentController;
__decorate([
    (0, common_1.Get)('active'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Versión vigente del consentimiento' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsentController.prototype, "active", null);
__decorate([
    (0, common_1.Get)('versions'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Historial de versiones publicadas' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsentController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('versions'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    (0, requires_permission_decorator_1.RequiresPermission)('settings', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Publicar una versión nueva del consentimiento' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, publish_consent_version_dto_1.PublishConsentVersionDto]),
    __metadata("design:returntype", Promise)
], ConsentController.prototype, "publish", null);
__decorate([
    (0, common_1.Get)('users'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Estado de aceptación por persona' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsentController.prototype, "byUser", null);
__decorate([
    (0, common_1.Get)('pending-count'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Cuántas personas faltan por aceptar' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConsentController.prototype, "pendingCount", null);
__decorate([
    (0, common_1.Post)('users/:id/grant'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    (0, requires_permission_decorator_1.RequiresPermission)('settings', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Otorgar acceso sin aceptación' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ConsentController.prototype, "grant", null);
exports.ConsentController = ConsentController = __decorate([
    (0, swagger_1.ApiTags)('Consentimiento'),
    (0, common_1.Controller)('consent'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('settings'),
    __param(0, (0, typeorm_1.InjectRepository)(consent_version_entity_1.ConsentVersion)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        organization_settings_service_1.OrganizationSettingsService,
        parameter_resolver_service_1.ParameterResolver,
        audit_service_1.AuditService,
        typeorm_2.DataSource])
], ConsentController);
