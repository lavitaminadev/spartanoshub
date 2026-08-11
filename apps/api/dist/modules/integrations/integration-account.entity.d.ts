import { Integration } from './integration.entity';
import { IntegrationAccountType } from './integration-account-type.enum';
export declare class IntegrationAccount {
    id: string;
    integrationId: string;
    integration: Integration;
    accountType: IntegrationAccountType;
    externalId: string;
    externalName: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
