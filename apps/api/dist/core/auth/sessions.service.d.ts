import { Repository } from 'typeorm';
import { UserSession } from './user-session.entity';
export declare const REVOKE_REASONS: {
    readonly USER: "cerrada_por_el_usuario";
    readonly PASSWORD_CHANGE: "cambio_de_contrasena";
    readonly ADMIN: "cerrada_por_administracion";
    readonly ROTATION_REUSE: "refresh_token_reutilizado";
};
export type RevokeReason = (typeof REVOKE_REASONS)[keyof typeof REVOKE_REASONS];
export declare const REAUTH_WINDOW_MINUTES = 15;
export interface SessionSummary {
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    lastSeenAt: Date | null;
    createdAt: Date;
    expiresAt: Date;
    current: boolean;
}
export declare function hashRefreshToken(token: string): string;
export declare class SessionsService {
    private readonly sessions;
    private readonly logger;
    constructor(sessions: Repository<UserSession>);
    open(userId: string, organizationId: string, refreshToken: string, expiresAt: Date, context?: {
        userAgent?: string;
        ipAddress?: string;
    }): Promise<UserSession>;
    findLive(refreshToken: string): Promise<UserSession | null>;
    rotate(sessionId: string, refreshToken: string, expiresAt: Date): Promise<void>;
    isLive(sessionId: string): Promise<boolean>;
    listOpen(userId: string, currentSessionId?: string): Promise<SessionSummary[]>;
    revoke(sessionId: string, userId: string, reason: RevokeReason): Promise<boolean>;
    revokeAll(userId: string, reason: RevokeReason, exceptSessionId?: string): Promise<number>;
    markReauthenticated(sessionId: string): Promise<void>;
    hasRecentAuth(sessionId: string, windowMinutes?: number): Promise<boolean>;
    touch(sessionId: string): Promise<void>;
    purgeExpired(olderThanDays?: number): Promise<number>;
}
