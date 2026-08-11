import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';
export declare class MetaIntegrationAccessor {
    private readonly integrations;
    constructor(integrations: Repository<Integration>);
    requireIntegration(id: string, organizationId: string): Promise<Integration>;
    getAccessToken(integration: Integration): string;
}
