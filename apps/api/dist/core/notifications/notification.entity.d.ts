import { User } from '../../modules/users/user.entity';
import { Organization } from '../../modules/organizations/organization.entity';
export declare class Notification {
    id: string;
    userId: string;
    user: User;
    organizationId: string;
    organization: Organization;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
    read: boolean;
    createdAt: Date;
}
