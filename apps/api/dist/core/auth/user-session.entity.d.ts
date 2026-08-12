import { User } from '../../modules/users/user.entity';
export declare class UserSession {
    id: string;
    userId: string;
    user?: User;
    organizationId: string;
    refreshTokenHash: string;
    reauthenticatedAt?: Date | null;
    userAgent?: string | null;
    ipAddress?: string | null;
    lastSeenAt?: Date | null;
    expiresAt: Date;
    revokedAt?: Date | null;
    revokedReason?: string | null;
    createdAt: Date;
}
