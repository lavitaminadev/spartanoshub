import { Repository } from 'typeorm';
import { UserRole } from '../organizations/user-role.enum';
import { XPDispute } from './xp-dispute.entity';
import { XPPeriod } from './xp-period.entity';
import { CreateXpDisputeDto, ResolveXpDisputeDto } from './dto/xp-dispute.dto';
export declare class XpDisputesService {
    private readonly disputes;
    private readonly periods;
    constructor(disputes: Repository<XPDispute>, periods: Repository<XPPeriod>);
    list(organizationId: string, userId: string, role: UserRole): Promise<XPDispute[]>;
    create(organizationId: string, userId: string, dto: CreateXpDisputeDto): Promise<XPDispute>;
    resolve(id: string, organizationId: string, actorId: string, dto: ResolveXpDisputeDto): Promise<XPDispute>;
}
