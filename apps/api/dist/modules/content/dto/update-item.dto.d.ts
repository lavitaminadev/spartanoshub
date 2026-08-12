import { ContentItemType } from '../content-item-type.enum';
import { ContentItemStatus } from '../content-item-status.enum';
export declare class UpdateContentItemDto {
    type?: ContentItemType;
    caption?: string;
    status?: ContentItemStatus;
    scheduledAt?: string;
    pieceId?: string;
    notes?: string;
}
