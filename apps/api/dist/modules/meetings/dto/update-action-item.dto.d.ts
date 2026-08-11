import { ActionItemStatus } from '../action-item-status.enum';
export declare class UpdateActionItemDto {
    description?: string;
    assignedTo?: string;
    dueAt?: string;
    status?: ActionItemStatus;
}
