import { Repository } from 'typeorm';
import { CreateClientUseCase } from './create-client.use-case';
import { ListClientsUseCase } from './list-clients.use-case';
import { GetClientUseCase } from './get-client.use-case';
import { Client } from './client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
import { UpdateClientDto } from './dto/update-client.dto';
import { User } from '../users/user.entity';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { ClientOverviewService } from './client-overview.service';
import { PaginationDto } from '../../shared/dto/pagination.dto';
export declare class ClientsController {
    private repo;
    private users;
    private readonly accountAccess;
    private readonly overviewService;
    private createClient;
    private listClients;
    private getClient;
    constructor(repo: Repository<Client>, users: Repository<User>, accountAccess: AccountAccessService, overviewService: ClientOverviewService, createClient: CreateClientUseCase, listClients: ListClientsUseCase, getClient: GetClientUseCase);
    create(dto: CreateClientDto, req: AuthenticatedRequest): Promise<Client>;
    list(pagination: PaginationDto, req: AuthenticatedRequest): Promise<{
        data: Client[];
        total: number;
        limit: number;
        offset: number;
    }>;
    managerOptions(req: AuthenticatedRequest): Promise<User[]>;
    overview(id: string, req: AuthenticatedRequest): Promise<import("./client-overview.service").ClientOverviewStats>;
    getOne(id: string, req: AuthenticatedRequest): Promise<Client>;
    update(id: string, dto: UpdateClientDto, req: AuthenticatedRequest): Promise<Client>;
    remove(id: string, req: AuthenticatedRequest): Promise<Client>;
}
