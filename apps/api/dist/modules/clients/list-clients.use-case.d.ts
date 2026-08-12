import { Repository } from 'typeorm';
import { Client } from './client.entity';
export declare class ListClientsUseCase {
    private repo;
    constructor(repo: Repository<Client>);
    execute(organizationId: string, clientIds?: string[], limit?: number, offset?: number): Promise<{
        data: Client[];
        total: number;
        limit: number;
        offset: number;
    }>;
}
