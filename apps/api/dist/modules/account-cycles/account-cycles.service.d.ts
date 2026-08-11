import { Repository } from 'typeorm';
import { AccountCycle } from './account-cycle.entity';
export declare class AccountCyclesService {
    private readonly cycles;
    constructor(cycles: Repository<AccountCycle>);
    ensure(organizationId: string, clientId: string, year: number, month: number): Promise<AccountCycle>;
    list(organizationId: string, year?: number, month?: number, clientIds?: string[]): Promise<AccountCycle[]>;
    update(id: string, organizationId: string, patch: Partial<AccountCycle>, clientIds?: string[]): Promise<AccountCycle>;
}
