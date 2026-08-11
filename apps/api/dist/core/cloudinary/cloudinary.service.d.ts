import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { Integration } from '../../modules/integrations/integration.entity';
export interface CloudinaryUploadResult {
    url: string;
    secureUrl: string;
    publicId: string;
    format: string;
    bytes: number;
    width?: number;
    height?: number;
}
export interface CloudinaryCredentials {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
}
export interface CloudinaryResource {
    publicId: string;
    url: string;
    format: string;
    bytes: number;
    width?: number;
    height?: number;
    createdAt: string;
}
export declare class CloudinaryService {
    private readonly integrations;
    private readonly http;
    private readonly logger;
    constructor(integrations: Repository<Integration>, http: HttpService);
    private envCredentials;
    getCredentials(organizationId?: string): Promise<CloudinaryCredentials | undefined>;
    isEnabled(organizationId?: string): Promise<boolean>;
    validateCredentials(credentials: CloudinaryCredentials): Promise<void>;
    uploadImage(buffer: Buffer, organizationId: string, options?: {
        folder?: string;
        fileName?: string;
        tags?: string[];
        mimeType?: string;
    }): Promise<CloudinaryUploadResult>;
    destroy(publicId: string, organizationId: string): Promise<void>;
    static folderFor(organizationId: string, clientId?: string): string;
    private belongsToOrganization;
    listResources(organizationId: string, options?: {
        maxResults?: number;
        nextCursor?: string;
        clientId?: string;
    }): Promise<{
        resources: CloudinaryResource[];
        nextCursor?: string;
    }>;
}
