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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const create_user_use_case_1 = require("./create-user.use-case");
const list_users_use_case_1 = require("./list-users.use-case");
const create_user_dto_1 = require("./dto/create-user.dto");
const update_user_dto_1 = require("./dto/update-user.dto");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const requires_recent_auth_decorator_1 = require("../../core/auth/requires-recent-auth.decorator");
const update_user_use_case_1 = require("./update-user.use-case");
const reset_user_password_use_case_1 = require("./reset-user-password.use-case");
const reset_user_password_dto_1 = require("./dto/reset-user-password.dto");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
let UsersController = class UsersController {
    constructor(createUser, listUsers, updateUser, resetUserPassword) {
        this.createUser = createUser;
        this.listUsers = listUsers;
        this.updateUser = updateUser;
        this.resetUserPassword = resetUserPassword;
    }
    create(dto, req) {
        return this.createUser.execute({
            ...dto,
            organizationId: req.organizationId || req.user.organizationId,
            actorRole: req.user.role,
        });
    }
    list(role, clientId, q, isActive, req) {
        const normalizedIsActive = isActive == null
            ? undefined
            : isActive.toLowerCase() === 'true'
                ? true
                : isActive.toLowerCase() === 'false'
                    ? false
                    : undefined;
        return this.listUsers.execute({
            organizationId: req.organizationId || req.user.organizationId,
            role,
            clientId,
            q,
            isActive: normalizedIsActive,
        });
    }
    update(id, dto, req) {
        return this.updateUser.execute({
            id,
            organizationId: req.organizationId || req.user.organizationId,
            actorId: req.user.id,
            actorRole: req.user.role,
            ...dto,
        });
    }
    resetPassword(id, dto, req) {
        return this.resetUserPassword.execute({
            id,
            organizationId: req.organizationId || req.user.organizationId,
            actorRole: req.user.role,
            sendEmail: dto.sendEmail,
        });
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Crear un nuevo usuario' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_user_dto_1.CreateUserDto, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Listar usuarios' }),
    __param(0, (0, common_1.Query)('role')),
    __param(1, (0, common_1.Query)('clientId')),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, common_1.Query)('isActive')),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, requires_recent_auth_decorator_1.RequiresRecentAuth)('cambiar los datos o el cargo de una persona'),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar usuario' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_user_dto_1.UpdateUserDto, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/reset-password'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, requires_recent_auth_decorator_1.RequiresRecentAuth)('restablecer la contraseña de otra persona'),
    (0, swagger_1.ApiOperation)({ summary: 'Generar una contraseña temporal y revocar sesiones activas' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, reset_user_password_dto_1.ResetUserPasswordDto, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "resetPassword", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('Usuarios'),
    (0, common_1.Controller)('users'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('users'),
    __metadata("design:paramtypes", [create_user_use_case_1.CreateUserUseCase,
        list_users_use_case_1.ListUsersUseCase,
        update_user_use_case_1.UpdateUserUseCase,
        reset_user_password_use_case_1.ResetUserPasswordUseCase])
], UsersController);
//# sourceMappingURL=users.controller.js.map