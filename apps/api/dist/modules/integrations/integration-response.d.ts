import { Integration } from './integration.entity';
import { IntegrationAccount } from './integration-account.entity';
export declare function toIntegrationResponse(integration: Integration): Integration;
export declare function toIntegrationAccountResponse(account: IntegrationAccount): {
    id: string;
    integrationId: string;
    integration: Integration;
    accountType: import("./integration-account-type.enum").IntegrationAccountType;
    externalId: string;
    externalName: string;
    tokenExpiresAt?: Date;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
};
export declare function assertConfigHasNoSecrets(config?: Record<string, unknown>): void;
