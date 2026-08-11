import { Repository } from 'typeorm';
import { IntegrationAccount } from '../integration-account.entity';
import { LeadIntakeService } from '../../crm/leads/lead-intake.service';
import { MetaLeadWebhookEvent } from './meta-lead-webhook-event.entity';
interface MetaLeadgenPayload {
    object?: string;
    entry?: Array<{
        id: string;
        changes?: Array<{
            field?: string;
            value?: {
                page_id?: string;
                form_id?: string;
                leadgen_id?: string;
                created_time?: number;
            };
        }>;
    }>;
}
export declare class MetaLeadAdsService {
    private readonly accountsRepo;
    private readonly eventsRepo;
    private readonly leadIntake;
    private readonly logger;
    constructor(accountsRepo: Repository<IntegrationAccount>, eventsRepo: Repository<MetaLeadWebhookEvent>, leadIntake: LeadIntakeService);
    processWebhook(payload: MetaLeadgenPayload, options?: {
        organizationId?: string;
    }): Promise<{
        accepted: number;
        createdOrUpdated: number;
    }>;
    syncSingleLead(pageId: string, leadgenId: string, organizationId?: string): Promise<{
        accepted: number;
        createdOrUpdated: number;
    }>;
    private extractLeadgenChanges;
    private retrieveLead;
    private normalizeLeadDetail;
}
export {};
