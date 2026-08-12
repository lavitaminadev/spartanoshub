import { Repository } from 'typeorm';
import { Interaction } from './interaction.entity';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { UpdateInteractionDto } from './dto/update-interaction.dto';
import { Lead } from '../leads/lead.entity';
import { Contact } from '../contacts/contact.entity';
export declare class InteractionsService {
    private readonly repo;
    private readonly leads;
    private readonly contacts;
    constructor(repo: Repository<Interaction>, leads: Repository<Lead>, contacts: Repository<Contact>);
    create(dto: CreateInteractionDto, organizationId: string, actorId: string): Promise<Interaction>;
    findAll(organizationId: string, limit?: number, offset?: number, leadId?: string): Promise<{
        data: Interaction[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOne(id: string, organizationId: string): Promise<Interaction>;
    update(id: string, dto: UpdateInteractionDto, organizationId: string): Promise<Interaction>;
    remove(id: string, organizationId: string): Promise<Interaction>;
    private validateReferences;
}
