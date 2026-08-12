import { DataSource, Repository } from 'typeorm';
import { Contact } from './contact.entity';
import { UpdateContactDto } from './dto/update-contact.dto';
export declare class ContactsService {
    private readonly repo;
    private readonly dataSource;
    constructor(repo: Repository<Contact>, dataSource: DataSource);
    findAll(organizationId: string, limit?: number, offset?: number, clientId?: string, allowedClientIds?: string[]): Promise<{
        data: Contact[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOne(id: string, organizationId: string, allowedClientIds?: string[]): Promise<Contact>;
    private clientScope;
    update(id: string, dto: UpdateContactDto, organizationId: string, allowedClientIds?: string[]): Promise<Contact>;
    segments(organizationId: string, clientId?: string, allowedClientIds?: string[]): Promise<Array<{
        id: string;
        label: string;
        count: number;
    }>>;
}
