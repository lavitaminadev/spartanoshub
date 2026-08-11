import { Repository } from 'typeorm';
import { CreateContentGridUseCase } from './create-content-grid.use-case';
import { ListContentGridsUseCase } from './list-content-grids.use-case';
import { CreateGridDto } from './dto/create-grid.dto';
import { ContentItem } from './content-item.entity';
import { ContentGrid } from './content-grid.entity';
import { AddContentItemDto } from './dto/add-content-item.dto';
import { UpdateContentItemDto } from './dto/update-item.dto';
import { UpdateGridStatusDto } from './dto/update-grid-status.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
export declare class ContentController {
    private createGrid;
    private listGrids;
    private itemRepo;
    private gridRepo;
    private readonly accountAccess;
    constructor(createGrid: CreateContentGridUseCase, listGrids: ListContentGridsUseCase, itemRepo: Repository<ContentItem>, gridRepo: Repository<ContentGrid>, accountAccess: AccountAccessService);
    create(dto: CreateGridDto, req: AuthenticatedRequest): Promise<ContentGrid>;
    list(clientId: string, month: string, req: AuthenticatedRequest): Promise<ContentGrid[]>;
    addItem(gridId: string, dto: AddContentItemDto, req: AuthenticatedRequest): Promise<ContentItem>;
    updateGridStatus(id: string, dto: UpdateGridStatusDto, req: AuthenticatedRequest): Promise<ContentGrid>;
    updateItem(id: string, dto: UpdateContentItemDto, req: AuthenticatedRequest): Promise<ContentItem>;
    deleteItem(id: string, req: AuthenticatedRequest): Promise<ContentItem>;
}
