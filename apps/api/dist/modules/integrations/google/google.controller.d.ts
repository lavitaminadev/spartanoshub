import { GoogleOAuthService } from './google-oauth.service';
import type { AuthenticatedRequest } from '../../../shared/types/request';
import { GoogleOAuthCallbackDto } from './dto/google-oauth-callback.dto';
import { GoogleDataService } from './google-data.service';
import { RegisterAnalyticsPropertyDto } from './dto/register-analytics-property.dto';
export declare class GoogleController {
    private readonly oauth;
    private readonly data;
    constructor(oauth: GoogleOAuthService, data: GoogleDataService);
    getAuthUrl(req: AuthenticatedRequest, redirectUri?: string): {
        url: string;
    };
    getStatus(): {
        configured: boolean;
        clientId: string | null;
        adsConfigured: boolean;
        adsApiVersion: string;
    };
    handleCallback(body: GoogleOAuthCallbackDto, req: AuthenticatedRequest): Promise<import("../integration.entity").Integration>;
    refresh(id: string, req: AuthenticatedRequest): Promise<import("../integration.entity").Integration>;
    disconnect(id: string, req: AuthenticatedRequest): Promise<import("../integration.entity").Integration>;
    listAccounts(id: string, req: AuthenticatedRequest): Promise<{
        id: string;
        externalId: string;
        name: string;
        type: import("../integration-account-type.enum").IntegrationAccountType;
        selected: boolean;
        clientId: string | null;
    }[]>;
    discoverAds(id: string, req: AuthenticatedRequest): Promise<{
        id: string;
        externalId: string;
        name: string;
        selected: boolean;
        clientId: any;
    }[]>;
    registerAnalytics(id: string, dto: RegisterAnalyticsPropertyDto, req: AuthenticatedRequest): Promise<import("../integration-account.entity").IntegrationAccount>;
    syncData(id: string, req: AuthenticatedRequest): Promise<{
        synced: number;
        skippedUnassignedAccounts: string[];
        failedAccounts: string[];
    }>;
}
