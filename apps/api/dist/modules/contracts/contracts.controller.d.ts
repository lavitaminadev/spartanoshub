import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
export declare class ContractsController {
    private service;
    constructor(service: ContractsService);
    create(dto: CreateContractDto, req: AuthenticatedRequest): Promise<import("./contract.entity").Contract>;
    findAll(query: PaginationDto, req: AuthenticatedRequest): Promise<{
        data: import("./contract.entity").Contract[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOne(id: string, req: AuthenticatedRequest): Promise<import("./contract.entity").Contract>;
    update(id: string, dto: UpdateContractDto, req: AuthenticatedRequest): Promise<import("./contract.entity").Contract>;
    remove(id: string, req: AuthenticatedRequest): Promise<import("./contract.entity").Contract>;
}
