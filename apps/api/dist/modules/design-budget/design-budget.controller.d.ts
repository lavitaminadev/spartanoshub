import { GetOrCreateBudgetUseCase } from './get-or-create-budget.use-case';
import { ReserveUdUseCase } from './reserve-ud.use-case';
import { ConfirmUdConsumptionUseCase } from './confirm-ud-consumption.use-case';
import { GetOrCreateBudgetDto } from './dto/get-or-create-budget.dto';
import { ReserveUdDto } from './dto/reserve-ud.dto';
import { ConfirmUdDto } from './dto/confirm-ud.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
export declare class DesignBudgetController {
    private getOrCreate;
    private reserve;
    private confirm;
    private readonly accountAccess;
    constructor(getOrCreate: GetOrCreateBudgetUseCase, reserve: ReserveUdUseCase, confirm: ConfirmUdConsumptionUseCase, accountAccess: AccountAccessService);
    getOrCreateBudget(dto: GetOrCreateBudgetDto, req: AuthenticatedRequest): Promise<import("./ud-budget.entity").UDBudget>;
    reserveUd(dto: ReserveUdDto, req: AuthenticatedRequest): Promise<import("./ud-budget.entity").UDBudget>;
    confirmUd(dto: ConfirmUdDto, req: AuthenticatedRequest): Promise<import("./ud-budget.entity").UDBudget>;
}
