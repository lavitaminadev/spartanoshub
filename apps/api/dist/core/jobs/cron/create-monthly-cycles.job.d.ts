import { Repository } from 'typeorm';
import { Client } from '../../../modules/clients/client.entity';
import { UDBudget } from '../../../modules/design-budget/ud-budget.entity';
import { AccountCyclesService } from '../../../modules/account-cycles/account-cycles.service';
export declare class CreateMonthlyCyclesJob {
    private clientRepo;
    private budgetRepo;
    private readonly cycles;
    private readonly logger;
    constructor(clientRepo: Repository<Client>, budgetRepo: Repository<UDBudget>, cycles: AccountCyclesService);
    handle(): Promise<void>;
}
