import { Repository } from 'typeorm';
import { Integration } from './integration.entity';
export declare class ListIntegrationsUseCase {
    private repo;
    constructor(repo: Repository<Integration>);
    execute(organizationId: string, provider?: string): Promise<Integration[]>;
}
