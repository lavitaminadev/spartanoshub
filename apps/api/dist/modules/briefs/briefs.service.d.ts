import { Repository } from 'typeorm';
import { Brief } from './brief.entity';
import { CreateBriefDto } from './dto/create-brief.dto';
import { UpdateBriefDto } from './dto/update-brief.dto';
import { Client } from '../clients/client.entity';
export declare class BriefsService {
    private readonly repo;
    private readonly clients;
    constructor(repo: Repository<Brief>, clients: Repository<Client>);
    create(dto: CreateBriefDto, organizationId: string): Promise<Brief>;
    findAll(organizationId: string, limit?: number, offset?: number): Promise<{
        data: Brief[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOne(id: string, organizationId: string): Promise<Brief>;
    update(id: string, dto: UpdateBriefDto, organizationId: string): Promise<Brief>;
    remove(id: string, organizationId: string): Promise<Brief>;
}
