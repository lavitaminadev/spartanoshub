import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
import { ContentGridStatus } from './content-grid-status.enum';
import { ContentItem } from './content-item.entity';
export declare class ContentGrid {
    id: string;
    organizationId: string;
    organization: Organization;
    clientId: string;
    client: Client;
    contentItems: ContentItem[];
    title: string;
    weekStart: Date;
    weekEnd: Date;
    status: ContentGridStatus;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
