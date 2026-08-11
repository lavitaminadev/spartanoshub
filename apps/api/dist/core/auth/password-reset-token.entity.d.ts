export declare class PasswordResetToken {
    id: string;
    organizationId: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt?: Date;
    createdAt: Date;
}
