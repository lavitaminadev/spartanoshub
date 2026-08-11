import { MetaPixelService } from './meta-pixel.service';
import { MetaConversionsService } from './meta-conversions.service';
import { MetaOAuthService } from './meta-oauth.service';
import { MetaAssetDiscoveryService } from './meta-asset-discovery.service';
import { MetaLeadAdsService } from './meta-lead-ads.service';
import type { AuthenticatedRequest } from '../../../shared/types/request';
import { MetaAssetSelectionDto, MetaClientPixelDto, MetaClientPixelSetupDto, MetaLeadSyncDto, MetaOAuthCallbackDto, MetaPixelDto } from './dto/meta-integration.dto';
import { MetaInsightsService } from './meta-insights.service';
import { MetaClientPixelService } from './meta-client-pixel.service';
import { MetaConversionOutboxService } from './meta-conversion-outbox.service';
export declare class MetaPixelController {
    private pixel;
    private conversions;
    private oauth;
    private assetDiscovery;
    private metaLeadAds;
    private insights;
    private clientPixels;
    private conversionOutbox;
    constructor(pixel: MetaPixelService, conversions: MetaConversionsService, oauth: MetaOAuthService, assetDiscovery: MetaAssetDiscoveryService, metaLeadAds: MetaLeadAdsService, insights: MetaInsightsService, clientPixels: MetaClientPixelService, conversionOutbox: MetaConversionOutboxService);
    clientPixelCatalog(req: AuthenticatedRequest): Promise<{
        bindings: {
            clientId: string;
            clientName: string;
            pixelId: string | null;
            pixelName: string | null;
            tokenConfigured: boolean;
            configuredAt: string | null;
        }[];
        pixels: {
            pixelId: string;
            clientNames: string[];
            pixelNames: string[];
            usageCount: number;
            tokenConfigured: boolean;
        }[];
    }>;
    conversionsOutbox(req: AuthenticatedRequest): Promise<{
        stats: {
            pending: number;
            retry: number;
            processing: number;
            failed: number;
            expired: number;
            processed: number;
            total: number;
        };
        problems: {
            id: string;
            eventId: string;
            pixelId: string;
            eventName: string | null;
            status: string;
            attempts: number;
            lastError: string | null;
            nextAttemptAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
    }>;
    setupClientPixel(dto: MetaClientPixelSetupDto, req: AuthenticatedRequest): Promise<{
        clientId: string;
        clientName: string;
        pixelId: null;
        tokenConfigured: boolean;
        configuredAt: null;
        pixelName?: undefined;
    } | {
        clientId: string;
        clientName: string;
        pixelId: string;
        pixelName: string | null;
        tokenConfigured: boolean;
        configuredAt: string;
    }>;
    listClientPixels(id: string, req: AuthenticatedRequest): Promise<{
        clientId: string;
        clientName: string;
        pixelId: string | null;
        pixelName: string | null;
        tokenConfigured: boolean;
        configuredAt: string | null;
    }[]>;
    configureClientPixel(id: string, dto: MetaClientPixelDto, req: AuthenticatedRequest): Promise<{
        clientId: string;
        clientName: string;
        pixelId: string;
        pixelName: string;
        tokenConfigured: boolean;
        configuredAt: string;
    }>;
    getAuthUrl(req: AuthenticatedRequest, redirectUri?: string): {
        url: string;
    };
    getStatus(): {
        configured: boolean;
        appId: string | null;
    };
    handleCallback(dto: MetaOAuthCallbackDto, req: AuthenticatedRequest): Promise<import("../integration.entity").Integration>;
    refresh(id: string, req: AuthenticatedRequest): Promise<import("../integration.entity").Integration>;
    disconnect(id: string, req: AuthenticatedRequest): Promise<import("../integration.entity").Integration>;
    assets(id: string, req: AuthenticatedRequest): Promise<import("./meta-asset-discovery.service").MetaAssetsResponse>;
    saveAssets(id: string, dto: MetaAssetSelectionDto, req: AuthenticatedRequest): Promise<{
        saved: boolean;
        assets: import("./meta-asset-discovery.service").MetaAssetsResponse;
    }>;
    health(id: string, req: AuthenticatedRequest): Promise<{
        connected: boolean;
        tokenExpiresAt: string | null;
        selectedAssets: number;
        scopes: any[];
        leadCaptureReady: boolean;
        credentialsEncrypted: boolean;
        pixelId: string | null;
        conversionsTokenSource: string;
        webhookConfigured: boolean;
        webhookUrl: string | null;
        capiConfigured: boolean;
        capiPending: number;
        capiFailed: number;
        leadEventsProcessed: number;
        leadEventsFailed: number;
    }>;
    syncInsights(id: string, req: AuthenticatedRequest): Promise<{
        synced: number;
        skippedUnassignedAccounts: string[];
        failedAccounts: string[];
    }>;
    syncLead(dto: MetaLeadSyncDto, req: AuthenticatedRequest): Promise<{
        accepted: number;
        createdOrUpdated: number;
    }>;
    validate(id: string, dto: MetaPixelDto, req: AuthenticatedRequest): Promise<{
        valid: boolean;
    }>;
    sendConversionTest(id: string, req: AuthenticatedRequest): Promise<any>;
}
