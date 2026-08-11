import { Repository } from 'typeorm';
import { Lead } from '../lead.entity';
export declare class GetLeadUseCase {
    private readonly repo;
    constructor(repo: Repository<Lead>);
    execute(id: string, organizationId: string): Promise<Lead>;
}
