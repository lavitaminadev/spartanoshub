"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = __importStar(require("bcryptjs"));
const crypto_1 = require("crypto");
const user_entity_1 = require("../../modules/users/user.entity");
const organization_entity_1 = require("../../modules/organizations/organization.entity");
const organization_features_1 = require("../../modules/organizations/organization-features");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const config_1 = require("../../config");
const password_reset_token_entity_1 = require("./password-reset-token.entity");
const email_service_1 = require("../notifications/email.service");
const consent_entity_1 = require("../data-protection/consent.entity");
const onboarding_dto_1 = require("./dto/onboarding.dto");
const parameter_resolver_service_1 = require("../parameters/parameter-resolver.service");
const sessions_service_1 = require("./sessions.service");
const REFRESH_TOKEN_EXPIRES_IN = config_1.config.jwt.refreshExpiresIn;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const ABSENT_USER_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
function toSharedRole(role) {
    return role;
}
function hashRefreshToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
function refreshLifetimeMs() {
    const match = /^(\d+)([smhd])$/.exec(String(config_1.config.jwt.refreshExpiresIn).trim());
    if (!match)
        return 7 * 86_400_000;
    const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return Number(match[1]) * units[match[2]];
}
let AuthService = AuthService_1 = class AuthService {
    constructor(userRepo, orgRepo, resetRepo, emailService, jwtService, parameters, sessions) {
        this.userRepo = userRepo;
        this.orgRepo = orgRepo;
        this.resetRepo = resetRepo;
        this.emailService = emailService;
        this.jwtService = jwtService;
        this.parameters = parameters;
        this.sessions = sessions;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async validateUser(email, password) {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await this.userRepo.findOne({
            where: { email: normalizedEmail, isActive: true },
            select: ['id', 'email', 'name', 'password', 'role', 'organizationId', 'avatarUrl', 'clientId', 'mustChangePassword', 'mustCompleteProfile', 'failedLoginAttempts', 'lockedUntil'],
        });
        if (!user) {
            await bcrypt.compare(password, ABSENT_USER_HASH);
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
            const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
            throw new common_1.UnauthorizedException(`Cuenta bloqueada por intentos fallidos. Vuelve a intentar en ${minutes} minuto(s).`);
        }
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            await this.registerFailedAttempt(user);
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
            await this.userRepo.update(user.id, { failedLoginAttempts: 0, lockedUntil: null });
        }
        await this.userRepo.update(user.id, { lastLoginAt: new Date() });
        return user;
    }
    async registerFailedAttempt(user) {
        const attempts = (user.failedLoginAttempts ?? 0) + 1;
        const reached = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;
        await this.userRepo.update(user.id, {
            failedLoginAttempts: reached ? 0 : attempts,
            lockedUntil: reached ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : user.lockedUntil ?? null,
        });
        if (reached) {
            this.logger.warn(`Cuenta ${user.id} bloqueada ${LOCKOUT_MINUTES} min tras ${MAX_FAILED_LOGIN_ATTEMPTS} intentos fallidos`);
        }
    }
    async login(user, context = {}) {
        const expiresAt = new Date(Date.now() + refreshLifetimeMs());
        const session = await this.sessions.open(user.id, user.organizationId, (0, crypto_1.randomUUID)(), expiresAt, context);
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
            clientId: user.clientId,
            sid: session.id,
        };
        const accessToken = this.jwtService.sign(payload);
        const refreshToken = this.jwtService.sign(payload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN, jwtid: (0, crypto_1.randomUUID)() });
        await this.sessions.rotate(session.id, refreshToken, expiresAt);
        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: toSharedRole(user.role),
                organizationId: user.organizationId,
                clientId: user.clientId,
                mustChangePassword: user.mustChangePassword,
            },
        };
    }
    async refreshToken(token) {
        try {
            const payload = this.jwtService.verify(token);
            const user = await this.userRepo.findOne({
                where: { id: payload.sub, isActive: true },
                select: ['id', 'refreshToken', 'email', 'role', 'organizationId', 'clientId'],
            });
            if (!user)
                throw new common_1.UnauthorizedException();
            const session = await this.sessions.findLive(token);
            if (!session || session.userId !== user.id) {
                const legacyHash = hashRefreshToken(token);
                if (user.refreshToken !== legacyHash && user.refreshToken !== token) {
                    throw new common_1.UnauthorizedException();
                }
                return this.issueForNewSession(user);
            }
            const newPayload = {
                sub: user.id,
                email: user.email,
                role: user.role,
                organizationId: user.organizationId,
                clientId: user.clientId,
                sid: session.id,
            };
            const accessToken = this.jwtService.sign(newPayload);
            const refreshToken = this.jwtService.sign(newPayload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN, jwtid: (0, crypto_1.randomUUID)() });
            await this.sessions.rotate(session.id, refreshToken, new Date(Date.now() + refreshLifetimeMs()));
            return { accessToken, refreshToken };
        }
        catch {
            throw new common_1.UnauthorizedException('Token de actualización inválido');
        }
    }
    async issueForNewSession(user) {
        const expiresAt = new Date(Date.now() + refreshLifetimeMs());
        const session = await this.sessions.open(user.id, user.organizationId, (0, crypto_1.randomUUID)(), expiresAt);
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
            clientId: user.clientId,
            sid: session.id,
        };
        const accessToken = this.jwtService.sign(payload);
        const refreshToken = this.jwtService.sign(payload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN, jwtid: (0, crypto_1.randomUUID)() });
        await this.sessions.rotate(session.id, refreshToken, expiresAt);
        await this.userRepo.update(user.id, { refreshToken: null });
        return { accessToken, refreshToken };
    }
    async register(data) {
        if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
            throw new common_1.ForbiddenException('El registro publico esta desactivado; solicita tu cuenta a un administrador');
        }
        const organizationId = process.env.AGENCY_ORGANIZATION_ID;
        if (!organizationId) {
            throw new common_1.ForbiddenException('El registro no está disponible por ahora');
        }
        const organization = await this.orgRepo.findOne({ where: { id: organizationId, isActive: true }, select: ['id'] });
        if (!organization) {
            throw new common_1.ForbiddenException('El registro no está disponible por ahora');
        }
        const email = data.email.trim().toLowerCase();
        const name = data.name.trim().replace(/\s+/g, ' ');
        const existing = await this.userRepo.findOne({ where: { email } });
        if (existing)
            throw new common_1.ConflictException('El correo ya está registrado');
        const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
        const hashed = await bcrypt.hash(data.password, rounds);
        const user = this.userRepo.create({
            email,
            password: hashed,
            name,
            organizationId,
            role: user_role_enum_1.UserRole.DESIGNER,
            mustCompleteProfile: true,
        });
        const saved = await this.userRepo.save(user);
        const payload = {
            sub: saved.id,
            email: saved.email,
            role: saved.role,
            organizationId: saved.organizationId,
            clientId: saved.clientId,
        };
        const accessToken = this.jwtService.sign(payload);
        const refreshToken = this.jwtService.sign(payload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN, jwtid: (0, crypto_1.randomUUID)() });
        await this.userRepo.update(saved.id, { refreshToken: hashRefreshToken(refreshToken) });
        return {
            accessToken,
            refreshToken,
            user: {
                id: saved.id,
                name: saved.name,
                email: saved.email,
                role: toSharedRole(saved.role),
                organizationId: saved.organizationId,
                clientId: saved.clientId,
                mustChangePassword: saved.mustChangePassword,
            },
        };
    }
    async logout(userId, sessionId) {
        if (sessionId) {
            await this.sessions.revoke(sessionId, userId, sessions_service_1.REVOKE_REASONS.USER);
        }
        else {
            await this.sessions.revokeAll(userId, sessions_service_1.REVOKE_REASONS.USER);
        }
        await this.userRepo.update(userId, { refreshToken: null });
    }
    async listSessions(userId, currentSessionId) {
        return this.sessions.listOpen(userId, currentSessionId);
    }
    async closeSession(userId, sessionId) {
        await this.sessions.revoke(sessionId, userId, sessions_service_1.REVOKE_REASONS.USER);
    }
    async closeOtherSessions(userId, currentSessionId) {
        return this.sessions.revokeAll(userId, sessions_service_1.REVOKE_REASONS.USER, currentSessionId);
    }
    async reauthenticate(userId, sessionId, password) {
        if (!sessionId)
            throw new common_1.UnauthorizedException('Vuelve a iniciar sesión para confirmar tu identidad');
        const user = await this.userRepo.findOne({ where: { id: userId, isActive: true }, select: ['id', 'password'] });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new common_1.UnauthorizedException('La contraseña no es correcta');
        }
        await this.sessions.markReauthenticated(sessionId);
        return { confirmed: true, validUntil: new Date(Date.now() + sessions_service_1.REAUTH_WINDOW_MINUTES * 60_000) };
    }
    async me(userId) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user)
            return null;
        const organization = await this.orgRepo.findOne({ where: { id: user.organizationId }, select: ['id', 'features'] });
        return Object.assign(user, {
            features: (0, organization_features_1.normalizeOrganizationFeatures)(organization?.features),
            mustAcceptTerms: await this.termsPending(user),
        });
    }
    async acceptCurrentTerms(userId, acceptedConsents, ipAddress) {
        const user = await this.userRepo.findOne({ where: { id: userId, isActive: true }, select: ['id', 'organizationId'] });
        if (!user)
            throw new common_1.BadRequestException('Usuario no disponible');
        const missing = onboarding_dto_1.REQUIRED_CONSENTS.filter((key) => !acceptedConsents.includes(key));
        if (missing.length > 0)
            throw new common_1.BadRequestException('Debes aceptar todas las condiciones para continuar');
        const version = await this.parameters.get('compliance.terms_version', null, null, user.organizationId) ?? onboarding_dto_1.TERMS_VERSION;
        const now = new Date();
        await this.userRepo.manager.transaction(async (manager) => {
            await manager.update(user_entity_1.User, userId, { termsAcceptedAt: now, termsVersion: String(version) });
            await manager.save(consent_entity_1.DataConsent, onboarding_dto_1.REQUIRED_CONSENTS.map((action) => manager.create(consent_entity_1.DataConsent, {
                userId,
                action: `${action}@${version}`,
                granted: true,
                ipAddress: ipAddress ?? null,
            })));
        });
        this.logger.log(`Usuario ${userId} re-aceptó las condiciones ${version}`);
        return { accepted: true };
    }
    async termsPending(user) {
        try {
            const [enforced, version, renewalMonths] = await Promise.all([
                this.parameters.get('compliance.terms_enforced', null, null, user.organizationId),
                this.parameters.get('compliance.terms_version', null, null, user.organizationId),
                this.parameters.get('compliance.terms_renewal_months', null, null, user.organizationId),
            ]);
            if (enforced === false)
                return false;
            if (!user.termsAcceptedAt)
                return true;
            if (version && user.termsVersion !== version)
                return true;
            const months = Number(renewalMonths) || 0;
            if (months <= 0)
                return false;
            const dueAt = new Date(user.termsAcceptedAt);
            dueAt.setMonth(dueAt.getMonth() + months);
            return dueAt.getTime() <= Date.now();
        }
        catch (error) {
            this.logger.warn(`No se pudo evaluar la vigencia de condiciones de ${user.id}: ${error instanceof Error ? error.message : error}`);
            return false;
        }
    }
    async updateProfile(userId, data) {
        const patch = {
            ...(data.name !== undefined ? { name: data.name.trim().replace(/\s+/g, ' ') } : {}),
            ...(data.email !== undefined ? { email: data.email.trim().toLowerCase() } : {}),
        };
        await this.userRepo.update(userId, patch);
        return this.userRepo.findOne({ where: { id: userId } });
    }
    async requestPasswordReset(rawEmail) {
        const user = await this.userRepo.findOne({ where: { email: rawEmail.trim().toLowerCase(), isActive: true } });
        if (!user)
            return { accepted: true };
        const now = new Date();
        await this.resetRepo.update({ userId: user.id, usedAt: (0, typeorm_2.IsNull)() }, { usedAt: now });
        const token = (0, crypto_1.randomBytes)(32).toString('base64url');
        await this.resetRepo.save(this.resetRepo.create({
            organizationId: user.organizationId,
            userId: user.id,
            tokenHash: (0, crypto_1.createHash)('sha256').update(token).digest('hex'),
            expiresAt: new Date(now.getTime() + 30 * 60_000),
        }));
        const appUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
        await this.emailService.sendPasswordReset(user.name, user.email, `${appUrl}/reset-password?token=${encodeURIComponent(token)}`);
        return { accepted: true };
    }
    async completePasswordReset(token, password) {
        const now = new Date();
        const record = await this.resetRepo.findOne({
            where: {
                tokenHash: (0, crypto_1.createHash)('sha256').update(token).digest('hex'),
                usedAt: (0, typeorm_2.IsNull)(),
                expiresAt: (0, typeorm_2.MoreThan)(now),
            },
        });
        if (!record)
            throw new common_1.BadRequestException('El enlace no es válido o ya venció');
        const user = await this.userRepo.findOne({ where: { id: record.userId, organizationId: record.organizationId, isActive: true } });
        if (!user)
            throw new common_1.BadRequestException('La cuenta ya no está disponible');
        user.password = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));
        user.mustChangePassword = false;
        user.passwordChangedAt = now;
        user.refreshToken = null;
        record.usedAt = now;
        await this.userRepo.manager.transaction(async (manager) => {
            await manager.save(user_entity_1.User, user);
            await manager.save(password_reset_token_entity_1.PasswordResetToken, record);
        });
        await this.sessions.revokeAll(user.id, sessions_service_1.REVOKE_REASONS.PASSWORD_CHANGE);
        return { changed: true };
    }
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.userRepo.findOne({ where: { id: userId, isActive: true }, select: ['id', 'password', 'mustChangePassword'] });
        if (!user || !await bcrypt.compare(currentPassword, user.password)) {
            throw new common_1.BadRequestException('La contraseña actual no es correcta');
        }
        if (await bcrypt.compare(newPassword, user.password))
            throw new common_1.BadRequestException('La nueva contraseña debe ser diferente');
        await this.userRepo.update(userId, {
            password: await bcrypt.hash(newPassword, Number(process.env.BCRYPT_ROUNDS || 10)),
            mustChangePassword: false,
            passwordChangedAt: new Date(),
            refreshToken: null,
        });
        await this.sessions.revokeAll(userId, sessions_service_1.REVOKE_REASONS.PASSWORD_CHANGE);
        return { changed: true };
    }
    async completeOnboarding(userId, dto, ipAddress) {
        const user = await this.userRepo.findOne({
            where: { id: userId, isActive: true },
            select: ['id', 'password', 'organizationId'],
        });
        if (!user || !await bcrypt.compare(dto.currentPassword, user.password)) {
            throw new common_1.BadRequestException('La contraseña actual no es correcta');
        }
        if (await bcrypt.compare(dto.newPassword, user.password)) {
            throw new common_1.BadRequestException('La nueva contraseña debe ser diferente');
        }
        const missing = onboarding_dto_1.REQUIRED_CONSENTS.filter((key) => !dto.acceptedConsents.includes(key));
        if (missing.length > 0) {
            throw new common_1.BadRequestException('Debes aceptar todas las condiciones para continuar');
        }
        const now = new Date();
        await this.userRepo.manager.transaction(async (manager) => {
            await manager.update(user_entity_1.User, userId, {
                name: dto.profile.name.trim(),
                phone: dto.profile.phone?.replace(/[^\d+]/g, '') || null,
                workMode: dto.profile.workMode,
                password: await bcrypt.hash(dto.newPassword, Number(process.env.BCRYPT_ROUNDS || 10)),
                mustChangePassword: false,
                mustCompleteProfile: false,
                passwordChangedAt: now,
                termsAcceptedAt: now,
                termsVersion: onboarding_dto_1.TERMS_VERSION,
                refreshToken: null,
            });
            await manager.save(consent_entity_1.DataConsent, onboarding_dto_1.REQUIRED_CONSENTS.map((action) => manager.create(consent_entity_1.DataConsent, {
                userId,
                action: `${action}@${onboarding_dto_1.TERMS_VERSION}`,
                granted: true,
                ipAddress: ipAddress ?? null,
            })));
        });
        this.logger.log(`Usuario ${userId} completó el primer ingreso y aceptó ${onboarding_dto_1.TERMS_VERSION}`);
        return { completed: true };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(organization_entity_1.Organization)),
    __param(2, (0, typeorm_1.InjectRepository)(password_reset_token_entity_1.PasswordResetToken)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        email_service_1.EmailService,
        jwt_1.JwtService,
        parameter_resolver_service_1.ParameterResolver,
        sessions_service_1.SessionsService])
], AuthService);
//# sourceMappingURL=auth.service.js.map