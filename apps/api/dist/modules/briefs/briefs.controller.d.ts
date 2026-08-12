import { BriefsService } from './briefs.service';
import { CreateBriefDto } from './dto/create-brief.dto';
import { UpdateBriefDto } from './dto/update-brief.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
export declare class BriefsController {
    private service;
    constructor(service: BriefsService);
    create(dto: CreateBriefDto, req: AuthenticatedRequest): Promise<import("./brief.entity").Brief>;
    findAll(query: PaginationDto, req: AuthenticatedRequest): Promise<{
        data: import("./brief.entity").Brief[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOne(id: string, req: AuthenticatedRequest): Promise<import("./brief.entity").Brief>;
    update(id: string, dto: UpdateBriefDto, req: AuthenticatedRequest): Promise<import("./brief.entity").Brief>;
    remove(id: string, req: AuthenticatedRequest): Promise<import("./brief.entity").Brief>;
}
