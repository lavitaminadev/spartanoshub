import { Organization } from '../organizations/organization.entity';
import { IntegrationProvider } from './integration-provider.enum';
import { IntegrationStatus } from './integration-status.enum';
export declare class Integration {
    id: string;
    organizationId: string;
    organization: Organization;
    provider: IntegrationProvider;
    name: string;
    status: IntegrationStatus;
    config?: Record<string, any>;
    errorMessage?: string;
    lastSyncAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
