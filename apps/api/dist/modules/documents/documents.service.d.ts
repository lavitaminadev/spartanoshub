import { Repository } from 'typeorm';
import { Document } from './document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { Client } from '../clients/client.entity';
export declare class DocumentsService {
    private readonly repo;
    private readonly clients;
    constructor(repo: Repository<Document>, clients: Repository<Client>);
    create(dto: CreateDocumentDto, organizationId: string, userId: string): Promise<Document>;
    findAll(organizationId: string, limit?: number, offset?: number, clientIds?: string[]): Promise<{
        data: Document[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOne(id: string, organizationId: string, clientIds?: string[]): Promise<Document>;
    update(id: string, dto: UpdateDocumentDto, organizationId: string): Promise<Document>;
    remove(id: string, organizationId: string): Promise<Document>;
}
