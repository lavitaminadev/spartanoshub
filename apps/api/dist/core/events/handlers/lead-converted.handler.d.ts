import { Repository } from 'typeorm';
import { Lead } from '../../../modules/crm/leads/lead.entity';
import { Client } from '../../../modules/clients/client.entity';
import { Onboarding } from '../../../modules/onboarding/onboarding.entity';
import { Notification } from '../../notifications/notification.entity';
import { WorkflowsService } from '../../../modules/workflows/workflows.service';
export declare class LeadConvertedHandler {
    private leadRepo;
    private clientRepo;
    private onboardingRepo;
    private notifRepo;
    private readonly workflows;
    private readonly logger;
    constructor(leadRepo: Repository<Lead>, clientRepo: Repository<Client>, onboardingRepo: Repository<Onboarding>, notifRepo: Repository<Notification>, workflows: WorkflowsService);
    handle(payload: {
        organizationId: string;
        leadId: string;
        clientId: string;
    }): Promise<void>;
}
