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
var SessionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionsService = exports.REAUTH_WINDOW_MINUTES = exports.REVOKE_REASONS = void 0;
exports.hashRefreshToken = hashRefreshToken;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const user_session_entity_1 = require("./user-session.entity");
exports.REVOKE_REASONS = {
    USER: 'cerrada_por_el_usuario',
    PASSWORD_CHANGE: 'cambio_de_contrasena',
    ADMIN: 'cerrada_por_administracion',
    ROTATION_REUSE: 'refresh_token_reutilizado',
};
exports.REAUTH_WINDOW_MINUTES = 15;
function hashRefreshToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
let SessionsService = SessionsService_1 = class SessionsService {
    constructor(sessions) {
        this.sessions = sessions;
        this.logger = new common_1.Logger(SessionsService_1.name);
    }
    async open(userId, organizationId, refreshToken, expiresAt, context = {}) {
        const session = this.sessions.create({
            userId,
            organizationId,
            refreshTokenHash: hashRefreshToken(refreshToken),
            userAgent: context.userAgent?.slice(0, 400) ?? null,
            ipAddress: context.ipAddress?.slice(0, 45) ?? null,
            reauthenticatedAt: new Date(),
            lastSeenAt: new Date(),
            expiresAt,
        });
        return this.sessions.save(session);
    }
    async findLive(refreshToken) {
        const session = await this.sessions.findOne({
            where: { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: (0, typeorm_2.IsNull)() },
        });
        if (!session)
            return null;
        if (session.expiresAt.getTime() <= Date.now())
            return null;
        return session;
    }
    async rotate(sessionId, refreshToken, expiresAt) {
        await this.sessions.update({ id: sessionId }, { refreshTokenHash: hashRefreshToken(refreshToken), expiresAt, lastSeenAt: new Date() });
    }
    async isLive(sessionId) {
        const session = await this.sessions.findOne({
            where: { id: sessionId },
            select: { id: true, revokedAt: true, expiresAt: true },
        });
        return Boolean(session && !session.revokedAt && session.expiresAt.getTime() > Date.now());
    }
    async listOpen(userId, currentSessionId) {
        const sessions = await this.sessions.find({
            where: { userId, revokedAt: (0, typeorm_2.IsNull)() },
            order: { createdAt: 'DESC' },
            take: 50,
        });
        return sessions
            .filter((session) => session.expiresAt.getTime() > Date.now())
            .map((session) => ({
            id: session.id,
            userAgent: session.userAgent ?? null,
            ipAddress: session.ipAddress ?? null,
            lastSeenAt: session.lastSeenAt ?? null,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            current: session.id === currentSessionId,
        }));
    }
    async revoke(sessionId, userId, reason) {
        const result = await this.sessions.update({ id: sessionId, userId, revokedAt: (0, typeorm_2.IsNull)() }, { revokedAt: new Date(), revokedReason: reason });
        return (result.affected ?? 0) > 0;
    }
    async revokeAll(userId, reason, exceptSessionId) {
        const query = this.sessions.createQueryBuilder()
            .update(user_session_entity_1.UserSession)
            .set({ revokedAt: new Date(), revokedReason: reason })
            .where('user_id = :userId AND revoked_at IS NULL', { userId });
        if (exceptSessionId)
            query.andWhere('id != :exceptSessionId', { exceptSessionId });
        const result = await query.execute();
        return result.affected ?? 0;
    }
    async markReauthenticated(sessionId) {
        await this.sessions.update({ id: sessionId }, { reauthenticatedAt: new Date() });
    }
    async hasRecentAuth(sessionId, windowMinutes = exports.REAUTH_WINDOW_MINUTES) {
        const session = await this.sessions.findOne({
            where: { id: sessionId },
            select: { id: true, reauthenticatedAt: true },
        });
        if (!session?.reauthenticatedAt)
            return false;
        return Date.now() - session.reauthenticatedAt.getTime() < windowMinutes * 60_000;
    }
    async touch(sessionId) {
        await this.sessions.update({ id: sessionId }, { lastSeenAt: new Date() });
    }
    async purgeExpired(olderThanDays = 90) {
        const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
        const result = await this.sessions.delete({ expiresAt: (0, typeorm_2.LessThan)(cutoff), revokedAt: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()) });
        const removed = result.affected ?? 0;
        if (removed > 0)
            this.logger.log(`Sesiones vencidas eliminadas: ${removed}`);
        return removed;
    }
};
exports.SessionsService = SessionsService;
exports.SessionsService = SessionsService = SessionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_session_entity_1.UserSession)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SessionsService);
//# sourceMappingURL=sessions.service.js.map