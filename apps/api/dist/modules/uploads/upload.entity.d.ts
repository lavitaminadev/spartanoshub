import { Organization } from '../organizations/organization.entity';
export declare class Upload {
    id: string;
    organizationId: string;
    organization: Organization;
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    path: string;
    driveFileId?: string;
    uploadedBy: string;
    createdAt: Date;
}
