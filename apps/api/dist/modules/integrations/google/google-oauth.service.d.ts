import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';
export declare class GoogleOAuthService {
    private readonly integrations;
    constructor(integrations: Repository<Integration>);
    getAuthorizationUrl(redirectUri: string, state: string): string;
    getClientId(): string | undefined;
    isConfigured(): boolean;
    disconnectIntegration(id: string, organizationId: string): Promise<Integration>;
    connectWithCode(organizationId: string, code: string, redirectUri: string): Promise<Integration>;
    refreshIntegration(id: string, organizationId: string): Promise<Integration>;
    private exchangeCode;
    private refreshAccessToken;
    private upsertIntegration;
}
