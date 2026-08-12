import type { AuthenticatedRequest } from '@shared/types/request';
import { UploadsService } from './uploads.service';
import { CloudinaryService } from '../../core/cloudinary/cloudinary.service';
declare class SyncDriveDto {
    folderId?: string;
}
export declare class UploadsController {
    private readonly service;
    private readonly cloudinary;
    constructor(service: UploadsService, cloudinary: CloudinaryService);
    upload(file: Express.Multer.File | undefined, req: AuthenticatedRequest): Promise<{
        id: string;
        organizationId: string;
        organization: import("../organizations/organization.entity").Organization;
        fileName: string;
        originalName: string;
        mimeType: string;
        size: number;
        driveFileId?: string;
        uploadedBy: string;
        createdAt: Date;
    }>;
    uploadImage(file: Express.Multer.File | undefined, req: AuthenticatedRequest, clientId?: string): Promise<{
        url: string;
        publicId: string;
        width: number | undefined;
        height: number | undefined;
    }>;
    getMetadata(id: string, req: AuthenticatedRequest): Promise<{
        id: string;
        organizationId: string;
        organization: import("../organizations/organization.entity").Organization;
        fileName: string;
        originalName: string;
        mimeType: string;
        size: number;
        driveFileId?: string;
        uploadedBy: string;
        createdAt: Date;
    }>;
    syncDrive(id: string, dto: SyncDriveDto, req: AuthenticatedRequest): Promise<{
        id: string;
        organizationId: string;
        organization: import("../organizations/organization.entity").Organization;
        fileName: string;
        originalName: string;
        mimeType: string;
        size: number;
        driveFileId?: string;
        uploadedBy: string;
        createdAt: Date;
    }>;
    delete(id: string, req: AuthenticatedRequest): Promise<{
        deleted: boolean;
    }>;
    deleteCloudinaryImage(publicId: string, req: AuthenticatedRequest): Promise<{
        deleted: boolean;
    }>;
}
export {};
