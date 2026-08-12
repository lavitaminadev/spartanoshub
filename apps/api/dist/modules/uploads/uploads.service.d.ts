import { Repository } from 'typeorm';
import { Upload } from './upload.entity';
import { Integration } from '../integrations/integration.entity';
import { GoogleOAuthService } from '../integrations/google/google-oauth.service';
export declare class UploadsService {
    private repo;
    private integrations;
    private readonly googleOAuth;
    private readonly uploadDir;
    constructor(repo: Repository<Upload>, integrations: Repository<Integration>, googleOAuth: GoogleOAuthService);
    upload(file: Express.Multer.File | undefined, organizationId: string, uploadedBy: string): Promise<Upload>;
    getFile(id: string, organizationId: string): Promise<Upload>;
    delete(id: string, organizationId: string): Promise<void>;
    syncToDrive(id: string, organizationId: string, folderId?: string): Promise<Upload>;
}
