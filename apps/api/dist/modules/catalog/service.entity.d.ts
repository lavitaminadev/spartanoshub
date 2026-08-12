import { Organization } from '../organizations/organization.entity';
import { ServiceCategory } from './service-category.enum';
import { ServiceStatus } from './service-status.enum';
export declare class Service {
    id: string;
    organizationId: string;
    organization: Organization;
    name: string;
    description?: string;
    category: ServiceCategory;
    unitPrice?: number;
    currency: string;
    udPerUnit: number;
    status: ServiceStatus;
    createdAt: Date;
    updatedAt: Date;
}
