import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
export declare class Document {
    id: string;
    organizationId: string;
    organization: Organization;
    clientId?: string;
    client?: Client;
    name: string;
    type: string;
    fileUrl?: string;
    driveFileId?: string;
    version: number;
    status: string;
    uploadedBy: string;
    uploader: User;
    tags?: string[];
    createdAt: Date;
    updatedAt: Date;
}
