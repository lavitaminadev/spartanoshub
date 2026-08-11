import type { AuthenticatedRequest } from '@shared/types/request';
import { AccountCyclesService } from './account-cycles.service';
import { UpdateAccountCycleDto } from './dto/update-account-cycle.dto';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
export declare class AccountCyclesController {
    private readonly service;
    private readonly accountAccess;
    constructor(service: AccountCyclesService, accountAccess: AccountAccessService);
    list(req: AuthenticatedRequest, year?: string, month?: string): Promise<import("./account-cycle.entity").AccountCycle[]>;
    update(id: string, patch: UpdateAccountCycleDto, req: AuthenticatedRequest): Promise<import("./account-cycle.entity").AccountCycle>;
}
