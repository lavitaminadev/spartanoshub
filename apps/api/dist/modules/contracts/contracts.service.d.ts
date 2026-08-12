import { Repository } from 'typeorm';
import { Contract } from './contract.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { Client } from '../clients/client.entity';
export declare class ContractsService {
    private readonly repo;
    private readonly clients;
    constructor(repo: Repository<Contract>, clients: Repository<Client>);
    create(dto: CreateContractDto, organizationId: string): Promise<Contract>;
    findAll(organizationId: string, limit?: number, offset?: number): Promise<{
        data: Contract[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOne(id: string, organizationId: string): Promise<Contract>;
    update(id: string, dto: UpdateContractDto, organizationId: string): Promise<Contract>;
    remove(id: string, organizationId: string): Promise<Contract>;
}
