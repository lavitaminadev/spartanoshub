import { CreateIntegrationUseCase } from './create-integration.use-case';
import { ListIntegrationsUseCase } from './list-integrations.use-case';
import { UpdateIntegrationUseCase } from './update-integration.use-case';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
import { IntegrationAccountsService } from './integration-accounts.service';
import { AssignIntegrationClientDto } from './dto/assign-integration-client.dto';
export declare class IntegrationsController {
    private createIntegration;
    private listIntegrations;
    private updateIntegration;
    private accounts;
    constructor(createIntegration: CreateIntegrationUseCase, listIntegrations: ListIntegrationsUseCase, updateIntegration: UpdateIntegrationUseCase, accounts: IntegrationAccountsService);
    create(dto: CreateIntegrationDto, req: AuthenticatedRequest): Promise<import("./integration.entity").Integration>;
    list(provider: string, req: AuthenticatedRequest): Promise<import("./integration.entity").Integration[]>;
    update(id: string, dto: UpdateIntegrationDto, req: AuthenticatedRequest): Promise<import("./integration.entity").Integration>;
    assignClient(accountId: string, dto: AssignIntegrationClientDto, req: AuthenticatedRequest): Promise<{
        id: string;
        integrationId: string;
        integration: import("./integration.entity").Integration;
        accountType: import("./integration-account-type.enum").IntegrationAccountType;
        externalId: string;
        externalName: string;
        tokenExpiresAt?: Date;
        metadata?: Record<string, any>;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
