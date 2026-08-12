import { Repository } from 'typeorm';
import { Lead } from '../lead.entity';
export interface ListLeadsFilters {
    status?: string;
    fitStatus?: string;
    source?: string;
    domain?: 'audience' | 'commercial' | 'all';
    clientId?: string;
    allowedClientIds?: string[];
}
export interface ListLeadsResult {
    data: Lead[];
    total: number;
    limit: number;
    offset: number;
}
export declare class ListLeadsUseCase {
    private repo;
    constructor(repo: Repository<Lead>);
    execute(organizationId: string, limit?: number, offset?: number, filters?: ListLeadsFilters): Promise<ListLeadsResult>;
    private resolveClientScope;
}
