import { XPPeriod } from './xp-period.entity';
import { User } from '../users/user.entity';
export declare class XPDispute {
    id: string;
    organizationId: string;
    xpPeriodId: string;
    period: XPPeriod;
    userId: string;
    user: User;
    message: string;
    status: string;
    resolution?: string;
    adjustmentPoints: number;
    resolvedBy?: string;
    resolvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
