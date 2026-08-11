import { Repository } from 'typeorm';
import { UDBudget } from './ud-budget.entity';
import { Client } from '../clients/client.entity';
export declare class GetOrCreateBudgetUseCase {
    private repo;
    private clients;
    constructor(repo: Repository<UDBudget>, clients: Repository<Client>);
    execute(organizationId: string, clientId: string, year: number, month: number, defaultBudget?: number): Promise<UDBudget>;
}
