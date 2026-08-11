import { NotificationService } from './notification.service';
import type { AuthenticatedRequest } from '@shared/types/request';
export declare class NotificationsController {
    private readonly service;
    constructor(service: NotificationService);
    private canReadSystemNotifications;
    findAll(req: AuthenticatedRequest): Promise<import("./notification.entity").Notification[]>;
    unreadCount(req: AuthenticatedRequest): Promise<{
        unread: number;
    }>;
    markAllAsRead(req: AuthenticatedRequest): Promise<{
        updated: number;
    }>;
    markAsRead(id: string, req: AuthenticatedRequest): Promise<import("./notification.entity").Notification>;
}
