import { Repository } from 'typeorm';
import { Client } from './client.entity';
export declare class GetClientUseCase {
    private repo;
    constructor(repo: Repository<Client>);
    execute(id: string, organizationId: string): Promise<Client>;
}
