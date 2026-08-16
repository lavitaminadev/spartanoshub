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
exports.PermissionsController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const common_2 = require("@nestjs/common");
const permission_resolver_service_1 = require("./permission-resolver.service");
const user_permission_override_entity_1 = require("./user-permission-override.entity");
const role_permission_override_entity_1 = require("./role-permission-override.entity");
const upsert_permission_override_dto_1 = require("./dto/upsert-permission-override.dto");
const update_role_matrix_dto_1 = require("./dto/update-role-matrix.dto");
const roles_decorator_1 = require("./roles.decorator");
const requires_recent_auth_decorator_1 = require("../auth/requires-recent-auth.decorator");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const user_entity_1 = require("../../modules/users/user.entity");
const organization_features_1 = require("../../modules/organizations/organization-features");
const permission_level_1 = require("./permission-level");
const role_permissions_1 = require("./role-permissions");
const audit_service_1 = require("../audit/audit.service");
const module_scope_decorator_1 = require("../authorization/module-scope.decorator");
const account_access_service_1 = require("../client-scope/account-access.service");
const user_client_access_entity_1 = require("../client-scope/user-client-access.entity");
const grant_client_access_dto_1 = require("./dto/grant-client-access.dto");
const client_entity_1 = require("../../modules/clients/client.entity");
let PermissionsController = class PermissionsController {
    constructor(permissions, overrides, roleOverrides, users, clientAccess, clients, accountAccess, audit) {
        this.permissions = permissions;
        this.overrides = overrides;
        this.roleOverrides = roleOverrides;
        this.users = users;
        this.clientAccess = clientAccess;
        this.clients = clients;
        this.accountAccess = accountAccess;
        this.audit = audit;
    }
    async roleMatrix(req) {
        return this.permissions.roleMatrix(req.organizationId);
    }
    async updateRoleMatrix(dto, req) {
        const organizationId = req.organizationId;
        const validRoles = new Set(Object.values(user_role_enum_1.UserRole));
        const desired = new Map();
        for (const [module, byRole] of Object.entries(dto.matrix ?? {})) {
            if (!(0, organization_features_1.isOrganizationFeatureKey)(module))
                throw new common_2.BadRequestException(`Módulo desconocido: ${module}`);
            for (const [role, level] of Object.entries(byRole ?? {})) {
                if (!validRoles.has(role))
                    throw new common_2.BadRequestException(`Cargo desconocido: ${role}`);
                if (!(0, permission_level_1.isPermissionLevel)(level))
                    throw new common_2.BadRequestException(`Nivel desconocido: ${level}`);
                if (level === this.permissions.codeLevel(role, module))
                    continue;
                desired.set(`${role}:${module}`, { role: role, module, level });
            }
        }
        const existing = await this.roleOverrides.find({ where: { organizationId } });
        const before = {};
        const after = {};
        const obsolete = existing.filter((row) => !desired.has(`${row.role}:${row.module}`));
        for (const row of obsolete) {
            before[`${row.role}:${row.module}`] = row.level;
            after[`${row.role}:${row.module}`] = (0, organization_features_1.isOrganizationFeatureKey)(row.module)
                ? this.permissions.codeLevel(row.role, row.module)
                : 'none';
        }
        if (obsolete.length > 0)
            await this.roleOverrides.remove(obsolete);
        const existingByCell = new Map(existing.map((row) => [`${row.role}:${row.module}`, row]));
        const toSave = [];
        for (const [key, cell] of desired) {
            const current = existingByCell.get(key);
            if (current?.level === cell.level)
                continue;
            before[key] = current?.level ?? this.permissions.codeLevel(cell.role, cell.module);
            after[key] = cell.level;
            toSave.push({
                ...(current ?? {}),
                organizationId,
                role: cell.role,
                module: cell.module,
                level: cell.level,
                reason: dto.reason ?? null,
                grantedBy: req.user.id,
            });
        }
        if (toSave.length > 0)
            await this.roleOverrides.save(toSave);
        this.permissions.invalidateOrganization(organizationId);
        if (Object.keys(after).length > 0) {
            await this.audit.log({
                organizationId,
                actorId: req.user.id,
                entityType: 'RolePermissionOverride',
                entityId: organizationId,
                action: 'updated',
                before,
                after,
                reason: dto.reason,
            });
        }
        return { ...(await this.permissions.roleMatrix(organizationId)), changed: Object.keys(after).length };
    }
    async listOverrides(req) {
        const rows = await this.overrides.find({
            where: { organizationId: req.organizationId },
            order: { createdAt: 'DESC' },
        });
        if (rows.length === 0)
            return { items: [] };
        const owners = await this.users.find({
            where: { id: (0, typeorm_2.In)([...new Set(rows.map((row) => row.userId))]) },
            select: { id: true, name: true, role: true },
        });
        const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
        const now = Date.now();
        return {
            items: rows.filter((row) => {
                if (req.user.role === user_role_enum_1.UserRole.DEV)
                    return true;
                return ownerById.get(row.userId)?.role !== user_role_enum_1.UserRole.DEV;
            }).map((row) => ({
                id: row.id,
                userId: row.userId,
                userName: ownerById.get(row.userId)?.name ?? 'Usuario no disponible',
                userRole: ownerById.get(row.userId)?.role,
                module: row.module,
                level: row.level,
                reason: row.reason ?? undefined,
                expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
                status: row.expiresAt && row.expiresAt.getTime() <= now ? 'expired' : 'active',
                createdAt: row.createdAt?.toISOString(),
            })),
        };
    }
    async mine(req) {
        const permissions = await this.permissions.permissionsFor(req.organizationId, req.user.id, req.user.role);
        return { permissions };
    }
    async ofRole(role, req) {
        if (!Object.values(user_role_enum_1.UserRole).includes(role))
            throw new common_2.NotFoundException('Cargo no encontrado');
        const permissions = Object.fromEntries(organization_features_1.ORGANIZATION_FEATURE_KEYS.map((module) => [module, (0, role_permissions_1.roleLevel)(role, module)]));
        void this.audit.log({
            organizationId: req.organizationId,
            actorId: req.user.id,
            entityType: 'authorization_roles',
            entityId: role,
            action: 'previewed',
            ipAddress: req.ip,
        }).catch(() => { });
        return { role, permissions };
    }
    async ofUser(id, req) {
        const user = await this.findUser(id, req.organizationId);
        return {
            userId: user.id,
            role: user.role,
            modules: await this.permissions.explain(req.organizationId, user.id, user.role),
        };
    }
    async upsert(id, module, dto, req) {
        if (!(0, organization_features_1.isOrganizationFeatureKey)(module))
            throw new common_2.BadRequestException(`Módulo desconocido: ${module}`);
        const user = await this.findUser(id, req.organizationId);
        this.assertCanManageUserPermissionException(req.user.role, user);
        const existing = await this.overrides.findOne({ where: { userId: user.id, module } });
        const saved = await this.overrides.save({
            ...(existing ?? {}),
            organizationId: req.organizationId,
            userId: user.id,
            module,
            level: dto.level,
            reason: dto.reason ?? null,
            grantedBy: req.user.id,
        });
        this.permissions.invalidateUser(user.id);
        await this.audit.log({
            organizationId: req.organizationId,
            actorId: req.user.id,
            entityType: 'UserPermissionOverride',
            entityId: saved.id,
            action: existing ? 'updated' : 'created',
            before: existing ? { level: existing.level, reason: existing.reason } : undefined,
            after: { module, level: dto.level, reason: dto.reason ?? null },
        });
        return saved;
    }
    async remove(id, module, req) {
        if (!(0, organization_features_1.isOrganizationFeatureKey)(module))
            throw new common_2.BadRequestException(`Módulo desconocido: ${module}`);
        const user = await this.findUser(id, req.organizationId);
        this.assertCanManageUserPermissionException(req.user.role, user);
        const existing = await this.overrides.findOne({ where: { userId: user.id, module } });
        if (!existing)
            throw new common_2.NotFoundException('No existe una excepción para ese módulo');
        await this.overrides.remove(existing);
        this.permissions.invalidateUser(user.id);
        await this.audit.log({
            organizationId: req.organizationId,
            actorId: req.user.id,
            entityType: 'UserPermissionOverride',
            entityId: existing.id,
            action: 'deleted',
            before: { module, level: existing.level, reason: existing.reason },
        });
        return { removed: true, module };
    }
    async clientAccessOfUser(id, req) {
        const user = await this.findUser(id, req.organizationId);
        const access = await this.accountAccess.explain(req.organizationId, {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId,
            clientId: user.clientId,
            tenantId: user.organizationId,
        });
        return { userId: user.id, role: user.role, access };
    }
    async grantClientAccess(id, clientId, dto, req) {
        const user = await this.findUser(id, req.organizationId);
        if (user.role === user_role_enum_1.UserRole.CLIENT) {
            throw new common_2.BadRequestException('El acceso de un cliente lo define su propia cuenta, no una asignación');
        }
        const client = await this.clients.findOne({ where: { id: clientId, organizationId: req.organizationId }, select: { id: true } });
        if (!client)
            throw new common_2.NotFoundException('Cuenta no encontrada');
        const existing = await this.clientAccess.findOne({ where: { userId: user.id, clientId: client.id } });
        const saved = await this.clientAccess.save({
            ...(existing ?? {}),
            organizationId: req.organizationId,
            userId: user.id,
            clientId: client.id,
            reason: dto.reason ?? null,
            grantedBy: req.user.id,
        });
        this.accountAccess.invalidateUser(user.id);
        await this.audit.log({
            organizationId: req.organizationId,
            actorId: req.user.id,
            entityType: 'UserClientAccess',
            entityId: saved.id,
            action: existing ? 'updated' : 'created',
            before: existing ? { reason: existing.reason } : undefined,
            after: { userId: user.id, clientId: client.id, reason: dto.reason ?? null },
        });
        return saved;
    }
    async revokeClientAccess(id, clientId, req) {
        const user = await this.findUser(id, req.organizationId);
        const existing = await this.clientAccess.findOne({ where: { userId: user.id, clientId } });
        if (!existing)
            throw new common_2.NotFoundException('No existe una asignación directa para esa cuenta');
        await this.clientAccess.remove(existing);
        this.accountAccess.invalidateUser(user.id);
        await this.audit.log({
            organizationId: req.organizationId,
            actorId: req.user.id,
            entityType: 'UserClientAccess',
            entityId: existing.id,
            action: 'deleted',
            before: { userId: user.id, clientId, reason: existing.reason },
        });
        const remaining = await this.accountAccess.allowedClientIds(req.organizationId, {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId,
            clientId: user.clientId,
            tenantId: user.organizationId,
        });
        return {
            removed: true,
            clientId,
            stillVisible: remaining === undefined || remaining.includes(clientId),
        };
    }
    async findUser(id, organizationId) {
        const user = await this.users.findOne({ where: { id, organizationId } });
        if (!user)
            throw new common_2.NotFoundException('Usuario no encontrado');
        return user;
    }
    assertCanManageUserPermissionException(actorRole, target) {
        if (actorRole === user_role_enum_1.UserRole.DEV)
            return;
        if (target.role === user_role_enum_1.UserRole.DEV) {
            throw new common_2.ForbiddenException('Las excepciones de una cuenta dev solo pueden administrarse con rol dev');
        }
    }
};
exports.PermissionsController = PermissionsController;
__decorate([
    (0, common_1.Get)('roles/permissions'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.DEV),
    (0, swagger_1.ApiOperation)({ summary: 'Matriz de permisos por cargo y módulo' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PermissionsController.prototype, "roleMatrix", null);
__decorate([
    (0, common_1.Put)('roles/permissions'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.DEV),
    (0, requires_recent_auth_decorator_1.RequiresRecentAuth)('cambiar los permisos de un cargo'),
    (0, swagger_1.ApiOperation)({ summary: 'Guardar la matriz de permisos por cargo' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_role_matrix_dto_1.UpdateRoleMatrixDto, Object]),
    __metadata("design:returntype", Promise)
], PermissionsController.prototype, "updateRoleMatrix", null);
__decorate([
    (0, common_1.Get)('permission-overrides'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Excepciones de permiso de toda la organización' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PermissionsController.prototype, "listOverrides", null);
__decorate([
    (0, common_1.Get)('me/permissions'),
    (0, roles_decorator_1.Roles)(...Object.values(user_role_enum_1.UserRole)),
    (0, swagger_1.ApiOperation)({ summary: 'Permisos efectivos del usuario autenticado' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PermissionsController.prototype, "mine", null);
__decorate([
    (0, common_1.Get)('roles/:role/permissions'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.DEV),
    (0, swagger_1.ApiOperation)({ summary: 'Permisos de un cargo, para previsualizacion' }),
    __param(0, (0, common_1.Param)('role')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PermissionsController.prototype, "ofRole", null);
__decorate([
    (0, common_1.Get)('users/:id/permissions'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Detalle de permisos de un usuario' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PermissionsController.prototype, "ofUser", null);
__decorate([
    (0, common_1.Put)('users/:id/permissions/:module'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Definir una excepción de permiso' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('module')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, upsert_permission_override_dto_1.UpsertPermissionOverrideDto, Object]),
    __metadata("design:returntype", Promise)
], PermissionsController.prototype, "upsert", null);
__decorate([
    (0, common_1.Delete)('users/:id/permissions/:module'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Quitar una excepción de permiso' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('module')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], PermissionsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('users/:id/client-access'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Cuentas visibles de un usuario y por qué las ve' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PermissionsController.prototype, "clientAccessOfUser", null);
__decorate([
    (0, common_1.Put)('users/:id/client-access/:clientId'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Conceder acceso a una cuenta' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('clientId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, grant_client_access_dto_1.GrantClientAccessDto, Object]),
    __metadata("design:returntype", Promise)
], PermissionsController.prototype, "grantClientAccess", null);
__decorate([
    (0, common_1.Delete)('users/:id/client-access/:clientId'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Retirar acceso a una cuenta' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('clientId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], PermissionsController.prototype, "revokeClientAccess", null);
exports.PermissionsController = PermissionsController = __decorate([
    (0, swagger_1.ApiTags)('Permisos'),
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('users'),
    __param(1, (0, typeorm_1.InjectRepository)(user_permission_override_entity_1.UserPermissionOverride)),
    __param(2, (0, typeorm_1.InjectRepository)(role_permission_override_entity_1.RolePermissionOverride)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(4, (0, typeorm_1.InjectRepository)(user_client_access_entity_1.UserClientAccess)),
    __param(5, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [permission_resolver_service_1.PermissionResolverService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        account_access_service_1.AccountAccessService,
        audit_service_1.AuditService])
], PermissionsController);
