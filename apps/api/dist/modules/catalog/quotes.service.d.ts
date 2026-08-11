import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { Contract } from '../contracts/contract.entity';
import { Lead } from '../crm/leads/lead.entity';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/quote.dto';
import { Quote } from './quote.entity';
import { Service } from './service.entity';
export declare class QuotesService {
    private readonly quotes;
    private readonly clients;
    private readonly leads;
    private readonly services;
    private readonly contracts;
    private readonly events;
    constructor(quotes: Repository<Quote>, clients: Repository<Client>, leads: Repository<Lead>, services: Repository<Service>, contracts: Repository<Contract>, events: EventEmitter2);
    list(organizationId: string): Promise<Quote[]>;
    create(organizationId: string, userId: string, dto: CreateQuoteDto): Promise<Quote>;
    update(id: string, organizationId: string, dto: UpdateQuoteDto): Promise<Quote>;
    createVersion(id: string, organizationId: string, userId: string): Promise<Quote>;
    send(id: string, organizationId: string): Promise<Quote>;
    accept(id: string, organizationId: string, _userId: string): Promise<{
        quote: Quote;
        client: Client;
        contract: Contract;
    }>;
    private find;
    private validateTarget;
    private normalizeItems;
    private total;
}
