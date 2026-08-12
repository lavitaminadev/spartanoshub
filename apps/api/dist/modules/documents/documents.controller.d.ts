import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
import { GoogleDriveService } from './google-drive.service';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
export declare class DocumentsController {
    private service;
    private drive;
    private readonly accountAccess;
    constructor(service: DocumentsService, drive: GoogleDriveService, accountAccess: AccountAccessService);
    create(dto: CreateDocumentDto, req: AuthenticatedRequest): Promise<import("./document.entity").Document>;
    findAll(query: PaginationDto, req: AuthenticatedRequest): Promise<{
        data: import("./document.entity").Document[];
        total: number;
        limit: number;
        offset: number;
    }>;
    bootstrapDrive(clientId: string, req: AuthenticatedRequest): Promise<{
        rootId: string;
        rootUrl: string;
        folders: Record<string, string>;
    }>;
    findOne(id: string, req: AuthenticatedRequest): Promise<import("./document.entity").Document>;
    update(id: string, dto: UpdateDocumentDto, req: AuthenticatedRequest): Promise<import("./document.entity").Document>;
    remove(id: string, req: AuthenticatedRequest): Promise<import("./document.entity").Document>;
}
