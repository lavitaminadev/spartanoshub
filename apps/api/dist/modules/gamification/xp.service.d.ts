import { EntityManager, Repository } from 'typeorm';
import { XPPeriod } from './xp-period.entity';
import { XPEvent } from './xp-event.entity';
import { Piece } from '../production/piece.entity';
import { RegisterXpUseCase } from './register-xp.use-case';
export declare class XPService {
    private periodRepo;
    private eventRepo;
    private registerXp;
    constructor(periodRepo: Repository<XPPeriod>, eventRepo: Repository<XPEvent>, registerXp: RegisterXpUseCase);
    registerDelivery(piece: Piece, designerId: string, deliveredAt: Date, manager?: EntityManager): Promise<void>;
    registerDesignerErrorPenalty(piece: Piece, designerId: string, manager?: EntityManager): Promise<void>;
    ensurePeriod(userId: string, date: Date): Promise<XPPeriod>;
    protected expectedHoursForLevel(level: number): number;
    private startOfWeek;
    private endOfWeek;
    private hoursDiff;
}
