import { Repository } from 'typeorm';
import { XPPeriod } from './xp-period.entity';
export declare function getCurrentWeekStart(now?: Date): Date;
export declare class GetWeeklyRankingUseCase {
    private repo;
    constructor(repo: Repository<XPPeriod>);
    execute(organizationId: string): Promise<XPPeriod[]>;
}
