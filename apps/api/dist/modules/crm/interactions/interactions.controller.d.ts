import { InteractionsService } from './interactions.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { UpdateInteractionDto } from './dto/update-interaction.dto';
import { ListInteractionsDto } from './dto/list-interactions.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
export declare class InteractionsController {
    private service;
    constructor(service: InteractionsService);
    create(dto: CreateInteractionDto, req: AuthenticatedRequest): Promise<import("./interaction.entity").Interaction>;
    findAll(query: ListInteractionsDto, req: AuthenticatedRequest): Promise<{
        data: import("./interaction.entity").Interaction[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOne(id: string, req: AuthenticatedRequest): Promise<import("./interaction.entity").Interaction>;
    update(id: string, dto: UpdateInteractionDto, req: AuthenticatedRequest): Promise<import("./interaction.entity").Interaction>;
    remove(id: string, req: AuthenticatedRequest): Promise<import("./interaction.entity").Interaction>;
}
