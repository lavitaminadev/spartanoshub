import { Repository } from 'typeorm';
import { Integration } from './integration.entity';
import { IntegrationStatus } from './integration-status.enum';
export declare class UpdateIntegrationUseCase {
    private repo;
    constructor(repo: Repository<Integration>);
    execute(id: string, data: {
        status?: IntegrationStatus;
        config?: Record<string, unknown>;
    }, organizationId: string): Promise<Integration>;
}
