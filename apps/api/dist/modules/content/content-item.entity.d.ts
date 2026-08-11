import { ContentGrid } from './content-grid.entity';
import { ContentItemType } from './content-item-type.enum';
import { ContentItemStatus } from './content-item-status.enum';
export declare class ContentItem {
    id: string;
    contentGridId: string;
    contentGrid: ContentGrid;
    type: ContentItemType;
    caption: string;
    status: ContentItemStatus;
    scheduledAt?: Date;
    pieceId?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
