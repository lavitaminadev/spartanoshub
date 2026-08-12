import { Repository } from 'typeorm';
import { CloudinaryConfigDto } from './dto/cloudinary-config.dto';
import { CloudinaryService } from './cloudinary.service';
import { Integration } from '../../modules/integrations/integration.entity';
import type { AuthenticatedRequest } from '@shared/types/request';
export declare class CloudinaryController {
    private readonly integrations;
    private readonly cloudinary;
    constructor(integrations: Repository<Integration>, cloudinary: CloudinaryService);
    getConfig(req: AuthenticatedRequest): Promise<{
        connected: boolean;
        cloudName: any;
        apiKey: string;
        hasApiKey: boolean;
        hasApiSecret: boolean;
        source: string;
    }>;
    saveConfig(req: AuthenticatedRequest, dto: CloudinaryConfigDto): Promise<{
        connected: boolean;
        cloudName: string;
        apiKey: string;
        source: string;
    }>;
    deleteConfig(req: AuthenticatedRequest): Promise<{
        connected: boolean;
    }>;
    listResources(req: AuthenticatedRequest, next?: string, limit?: string, clientId?: string): Promise<{
        resources: import("./cloudinary.service").CloudinaryResource[];
        nextCursor?: string;
    }>;
}
