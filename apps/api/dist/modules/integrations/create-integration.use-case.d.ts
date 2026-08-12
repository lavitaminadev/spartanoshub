import { Repository } from 'typeorm';
import { Integration } from './integration.entity';
import { IntegrationProvider } from './integration-provider.enum';
export declare class CreateIntegrationUseCase {
    private repo;
    constructor(repo: Repository<Integration>);
    execute(data: {
        organizationId: string;
        provider: IntegrationProvider;
        name: string;
        config?: Record<string, any>;
    }): Promise<Integration>;
}
