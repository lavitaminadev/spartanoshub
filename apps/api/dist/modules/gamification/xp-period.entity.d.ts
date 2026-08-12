import { User } from '../users/user.entity';
export declare class XPPeriod {
    id: string;
    organizationId: string;
    userId: string;
    user: User;
    weekStart: Date;
    weekEnd: Date;
    totalXp: number;
    tier?: string;
    status: string;
    closedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
