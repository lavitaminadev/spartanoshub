import { Repository } from 'typeorm';
import { Client } from '../../clients/client.entity';
import { Integration } from '../integration.entity';
import { MetaPixelService } from './meta-pixel.service';
export declare class MetaClientPixelService {
    private readonly integrations;
    private readonly clients;
    private readonly pixels;
    constructor(integrations: Repository<Integration>, clients: Repository<Client>, pixels: MetaPixelService);
    private integration;
    private organizationIntegration;
    private records;
    list(id: string, organizationId: string): Promise<{
        clientId: string;
        clientName: string;
        pixelId: string | null;
        pixelName: string | null;
        tokenConfigured: boolean;
        configuredAt: string | null;
    }[]>;
    private catalogRows;
    catalog(organizationId: string): Promise<{
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
    configure(id: string, organizationId: string, clientId: string, pixelId: string, accessToken?: string, pixelName?: string): Promise<{
        clientId: string;
        clientName: string;
        pixelId: string;
        pixelName: string;
        tokenConfigured: boolean;
        configuredAt: string;
    }>;
    private configureRecord;
    setup(organizationId: string, clientId: string, mode: 'none' | 'manual' | 'existing', input: {
        pixelId?: string;
        existingPixelId?: string;
        pixelName?: string;
        accessToken?: string;
    }): Promise<{
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
    resolve(organizationId: string, clientId: string): Promise<{
        pixelId: string;
        pixelName: string | null;
        accessToken: string | undefined;
    }>;
    resolveByPixel(organizationId: string, pixelId: string): Promise<string | undefined>;
}
