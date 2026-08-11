import { Repository } from 'typeorm';
import { Invoice } from '../invoice.entity';
export declare class ListInvoicesUseCase {
    private readonly repo;
    constructor(repo: Repository<Invoice>);
    execute(organizationId: string, limit?: number, offset?: number): Promise<{
        data: Invoice[];
        total: number;
        limit: number;
        offset: number;
    }>;
}
