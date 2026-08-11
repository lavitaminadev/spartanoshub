import { Repository } from 'typeorm';
import { Invoice } from '../../../modules/billing/invoice.entity';
import { Client } from '../../../modules/clients/client.entity';
import { EmailService } from '../../notifications/email.service';
export declare class CollectionEmailsJob {
    private invoiceRepo;
    private clientRepo;
    private emailService;
    private readonly logger;
    constructor(invoiceRepo: Repository<Invoice>, clientRepo: Repository<Client>, emailService: EmailService);
    handle(): Promise<void>;
    private resolveClientEmail;
}
