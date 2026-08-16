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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const auth_service_1 = require("./auth.service");
const login_dto_1 = require("./dto/login.dto");
const register_dto_1 = require("./dto/register.dto");
const refresh_dto_1 = require("./dto/refresh.dto");
const update_profile_dto_1 = require("./dto/update-profile.dto");
const current_user_decorator_1 = require("./decorators/current-user.decorator");
const public_decorator_1 = require("./decorators/public.decorator");
const auth_guard_1 = require("./auth.guard");
const roles_decorator_1 = require("../authorization/roles.decorator");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const config_1 = require("../../config");
const password_reset_dto_1 = require("./dto/password-reset.dto");
const onboarding_dto_1 = require("./dto/onboarding.dto");
const reauthenticate_dto_1 = require("./dto/reauthenticate.dto");
const module_scope_decorator_1 = require("../authorization/module-scope.decorator");
const REFRESH_COOKIE = 'espartanos_refresh';
const LEGACY_REFRESH_COOKIE = 'vitahub_refresh';
const REFRESH_COOKIE_PATH = '/api/auth';
function sessionDurationMs(value) {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match)
        return 7 * 24 * 60 * 60 * 1000;
    const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return Number(match[1]) * units[match[2]];
}
const REFRESH_COOKIE_MAX_AGE_MS = sessionDurationMs(config_1.config.jwt.refreshExpiresIn);
function readCookie(request, name) {
    const match = request.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));
    if (!match)
        return undefined;
    try {
        return decodeURIComponent(match.slice(name.length + 1));
    }
    catch {
        return undefined;
    }
}
function readRefreshCookie(request) {
    return readCookie(request, REFRESH_COOKIE) ?? readCookie(request, LEGACY_REFRESH_COOKIE);
}
function setRefreshCookie(response, token) {
    response.cookie(REFRESH_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: REFRESH_COOKIE_PATH,
        maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
    response.clearCookie(LEGACY_REFRESH_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: REFRESH_COOKIE_PATH });
}
function clearRefreshCookie(response) {
    for (const name of [REFRESH_COOKIE, LEGACY_REFRESH_COOKIE]) {
        response.clearCookie(name, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: REFRESH_COOKIE_PATH,
        });
    }
}
let AuthController = class AuthController {
    constructor(auth) {
        this.auth = auth;
    }
    async register(dto, response) {
        const { refreshToken, ...session } = await this.auth.register(dto);
        setRefreshCookie(response, refreshToken);
        return session;
    }
    async login(dto, request, ip, response) {
        const user = await this.auth.validateUser(dto.email, dto.password);
        const tokens = await this.auth.login(user, { userAgent: request.headers['user-agent'], ipAddress: ip });
        setRefreshCookie(response, tokens.refreshToken);
        return {
            accessToken: tokens.accessToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl,
                clientId: user.clientId,
                organizationId: user.organizationId,
                mustChangePassword: user.mustChangePassword,
            },
        };
    }
    async refresh(dto, request, response) {
        const token = readRefreshCookie(request) ?? dto?.refreshToken;
        const refreshed = await this.auth.refreshToken(token ?? '');
        setRefreshCookie(response, refreshed.refreshToken);
        return { accessToken: refreshed.accessToken };
    }
    async browserSession(dto, request, response) {
        const token = readRefreshCookie(request) ?? dto?.refreshToken;
        if (!token)
            return { authenticated: false };
        try {
            const refreshed = await this.auth.refreshToken(token);
            setRefreshCookie(response, refreshed.refreshToken);
            return { authenticated: true, accessToken: refreshed.accessToken };
        }
        catch (error) {
            if (!(error instanceof common_1.UnauthorizedException))
                throw error;
            clearRefreshCookie(response);
            return { authenticated: false };
        }
    }
    async logout(user, response) {
        await this.auth.logout(user.id, user.sessionId);
        clearRefreshCookie(response);
    }
    async listSessions(user) {
        return this.auth.listSessions(user.id, user.sessionId);
    }
    async closeOtherSessions(user) {
        return { closed: await this.auth.closeOtherSessions(user.id, user.sessionId) };
    }
    async closeSession(user, id) {
        await this.auth.closeSession(user.id, id);
    }
    async reauthenticate(user, dto) {
        return this.auth.reauthenticate(user.id, user.sessionId, dto.password);
    }
    async me(user) {
        return this.auth.me(user.id);
    }
    async updateProfile(user, dto) {
        return this.auth.updateProfile(user.id, dto);
    }
    requestPasswordReset(dto) {
        return this.auth.requestPasswordReset(dto.email);
    }
    completePasswordReset(dto) {
        return this.auth.completePasswordReset(dto.token, dto.password);
    }
    async changePassword(user, dto, response) {
        const result = await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
        clearRefreshCookie(response);
        return result;
    }
    async completeOnboarding(user, dto, ipAddress, response) {
        const result = await this.auth.completeOnboarding(user.id, user.sessionId, dto, ipAddress);
        clearRefreshCookie(response);
        return result;
    }
    acceptTerms(user, dto, ipAddress) {
        return this.auth.acceptCurrentTerms(user.id, dto.acceptedConsents, ipAddress, dto.termsVersion);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('register'),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Registrar nuevo usuario' }),
    (0, swagger_1.ApiBody)({ type: register_dto_1.RegisterDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('login'),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Iniciar sesión' }),
    (0, swagger_1.ApiBody)({ type: login_dto_1.LoginDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object, String, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('refresh'),
    (0, throttler_1.Throttle)({ default: { limit: 60, ttl: 60000 } }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Refrescar token de acceso' }),
    (0, swagger_1.ApiBody)({ type: refresh_dto_1.RefreshDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [refresh_dto_1.RefreshDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('session'),
    (0, throttler_1.Throttle)({ default: { limit: 60, ttl: 60000 } }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Comprobar y restaurar la sesión del navegador' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [refresh_dto_1.RefreshDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "browserSession", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    (0, roles_decorator_1.Roles)(...Object.values(user_role_enum_1.UserRole)),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Cerrar sesion y revocar credenciales' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('sessions'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    (0, roles_decorator_1.Roles)(...Object.values(user_role_enum_1.UserRole)),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar mis sesiones abiertas' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "listSessions", null);
__decorate([
    (0, common_1.Delete)('sessions'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    (0, roles_decorator_1.Roles)(...Object.values(user_role_enum_1.UserRole)),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Cerrar todas mis otras sesiones' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "closeOtherSessions", null);
__decorate([
    (0, common_1.Delete)('sessions/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    (0, roles_decorator_1.Roles)(...Object.values(user_role_enum_1.UserRole)),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Cerrar una sesión concreta' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "closeSession", null);
__decorate([
    (0, common_1.Post)('reauthenticate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    (0, roles_decorator_1.Roles)(...Object.values(user_role_enum_1.UserRole)),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Confirmar la contraseña para operaciones críticas' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reauthenticate_dto_1.ReauthenticateDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "reauthenticate", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    (0, roles_decorator_1.Roles)(...Object.values(user_role_enum_1.UserRole)),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener perfil del usuario autenticado' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Put)('profile'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    (0, roles_decorator_1.Roles)(...Object.values(user_role_enum_1.UserRole)),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar perfil del usuario' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_profile_dto_1.UpdateProfileDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "updateProfile", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('password/request-reset'),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    (0, swagger_1.ApiOperation)({ summary: 'Solicitar recuperación de contraseña' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [password_reset_dto_1.RequestPasswordResetDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "requestPasswordReset", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('password/reset'),
    (0, throttler_1.Throttle)({ default: { limit: 8, ttl: 60000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Completar recuperación de contraseña' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [password_reset_dto_1.CompletePasswordResetDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "completePasswordReset", null);
__decorate([
    (0, common_1.Put)('password'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    (0, roles_decorator_1.Roles)(...Object.values(user_role_enum_1.UserRole)),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Cambiar contraseña autenticada' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, password_reset_dto_1.ChangePasswordDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Post)('onboarding'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    (0, roles_decorator_1.Roles)(...Object.values(user_role_enum_1.UserRole)),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Completar el primer acceso: datos, condiciones y contraseña' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, onboarding_dto_1.CompleteOnboardingDto, String, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "completeOnboarding", null);
__decorate([
    (0, common_1.Post)('terms/accept'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    (0, roles_decorator_1.Roles)(...Object.values(user_role_enum_1.UserRole)),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Aceptar la versión vigente de las condiciones' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, onboarding_dto_1.AcceptTermsDto, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "acceptTerms", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Autenticación'),
    (0, common_1.Controller)('auth'),
    (0, module_scope_decorator_1.ModuleExempt)('Autoservicio de la propia cuenta: sesion, perfil y contrasena'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
