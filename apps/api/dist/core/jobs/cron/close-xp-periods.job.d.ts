import { Repository } from 'typeorm';
import { XPPeriod } from '../../../modules/gamification/xp-period.entity';
import { XPEvent } from '../../../modules/gamification/xp-event.entity';
export declare class CloseXpPeriodsJob {
    private periodRepo;
    private eventRepo;
    private readonly logger;
    constructor(periodRepo: Repository<XPPeriod>, eventRepo: Repository<XPEvent>);
    handle(): Promise<void>;
    private closeThrough;
}
