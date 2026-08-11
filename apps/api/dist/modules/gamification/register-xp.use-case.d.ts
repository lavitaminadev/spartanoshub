import { Repository, EntityManager } from 'typeorm';
import { XPPeriod } from './xp-period.entity';
import { XPEvent } from './xp-event.entity';
import { XPEventType } from './xp-event-type.enum';
export declare class RegisterXpUseCase {
    private periodRepo;
    private eventRepo;
    constructor(periodRepo: Repository<XPPeriod>, eventRepo: Repository<XPEvent>);
    private assertUserBelongsToOrganization;
    executeDelivery(params: {
        organizationId: string;
        userId: string;
        pieceId: string;
        difficultyLevel: number;
        actualHours: number;
        expectedHours?: number;
        perfectNaming: boolean;
        hadDesignerErrorCorrection: boolean;
        delayJustification?: string;
        description?: string;
        metadata?: Record<string, any>;
    }, transactionManager?: EntityManager): Promise<XPPeriod>;
    executePenalty(params: {
        organizationId: string;
        userId: string;
        pieceId: string;
        points: number;
        eventType: XPEventType;
    }, transactionManager?: EntityManager): Promise<XPPeriod>;
}
