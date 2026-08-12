import { ContentItemType } from '../content-item-type.enum';
import { ContentItemStatus } from '../content-item-status.enum';
export declare class AddContentItemDto {
    caption: string;
    type: ContentItemType;
    scheduledAt?: string;
    status?: ContentItemStatus;
    notes?: string;
    pieceId?: string;
}
