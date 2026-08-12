import { RegisterXpUseCase } from './register-xp.use-case';
import { GetWeeklyRankingUseCase } from './get-weekly-ranking.use-case';
import { RegisterDeliveryDto } from './dto/register-delivery.dto';
import { RegisterPenaltyDto } from './dto/register-penalty.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
import { XpDisputesService } from './xp-disputes.service';
import { CreateXpDisputeDto, ResolveXpDisputeDto } from './dto/xp-dispute.dto';
export declare class GamificationController {
    private registerXp;
    private ranking;
    private readonly disputes;
    constructor(registerXp: RegisterXpUseCase, ranking: GetWeeklyRankingUseCase, disputes: XpDisputesService);
    registerDelivery(dto: RegisterDeliveryDto, req: AuthenticatedRequest): Promise<import("./xp-period.entity").XPPeriod>;
    registerPenalty(dto: RegisterPenaltyDto, req: AuthenticatedRequest): Promise<import("./xp-period.entity").XPPeriod>;
    getRanking(req: AuthenticatedRequest): Promise<import("./xp-period.entity").XPPeriod[]>;
    listDisputes(req: AuthenticatedRequest): Promise<import("./xp-dispute.entity").XPDispute[]>;
    createDispute(req: AuthenticatedRequest, dto: CreateXpDisputeDto): Promise<import("./xp-dispute.entity").XPDispute>;
    resolveDispute(req: AuthenticatedRequest, id: string, dto: ResolveXpDisputeDto): Promise<import("./xp-dispute.entity").XPDispute>;
}
