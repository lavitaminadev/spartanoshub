import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
export declare class NotificationService {
    private repo;
    constructor(repo: Repository<Notification>);
    notifyUser(organizationId: string, userId: string, type: string, title: string, message: string, data?: Record<string, any>): Promise<Notification>;
    notifyRole(orgId: string, role: string, type: string, title: string, message: string, data?: Record<string, any>): Promise<Notification[]>;
    notifyMultiple(organizationId: string, userIds: string[], type: string, title: string, message: string, data?: Record<string, any>): Promise<Notification[]>;
    findByUser(organizationId: string, userId: string, includeSystem?: boolean): Promise<Notification[]>;
    markAsRead(organizationId: string, id: string, userId: string, includeSystem?: boolean): Promise<Notification | null>;
    unreadCount(organizationId: string, userId: string, includeSystem?: boolean): Promise<number>;
    markAllAsRead(organizationId: string, userId: string, includeSystem?: boolean): Promise<{
        updated: number;
    }>;
}
