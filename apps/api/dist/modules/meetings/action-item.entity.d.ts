import { Meeting } from './meeting.entity';
import { User } from '../users/user.entity';
import { ActionItemStatus } from './action-item-status.enum';
export declare class ActionItem {
    id: string;
    meetingId: string;
    meeting: Meeting;
    description: string;
    assignedTo?: string;
    assignee?: User;
    dueAt?: Date;
    completedAt?: Date;
    status: ActionItemStatus;
    createdAt: Date;
    updatedAt: Date;
}
