import { Repository } from 'typeorm';
import { AuditService } from '../../../core/audit/audit.service';
import { Lead } from './lead.entity';
import { CrmLeadAutomationService } from './crm-lead-automation.service';
import { Contact } from '../contacts/contact.entity';
interface LeadMetadata {
    scoringSignals?: string[];
    [key: string]: string | number | boolean | string[] | Record<string, unknown> | Record<string, unknown>[] | undefined;
}
export type LeadDomain = 'commercial' | 'audience';
export interface LeadCaptureInput {
    organizationId: string;
    clientId?: string;
    domain?: LeadDomain;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    source?: string;
    sourceDetail?: string;
    notes?: string;
    externalLeadId?: string;
    externalFormId?: string;
    externalCampaignId?: string;
    campaignName?: string;
    pageId?: string;
    status?: string;
    tags?: string[];
    consentCapturedAt?: Date;
    metadata?: LeadMetadata;
}
export declare class LeadIntakeService {
    private readonly repo;
    private readonly automation;
    private readonly audit;
    private readonly logger;
    constructor(repo: Repository<Lead>, automation: CrmLeadAutomationService, audit: AuditService);
    captureAudience(input: Omit<LeadCaptureInput, 'domain'>): Promise<{
        lead: Lead;
        contact: Contact | null;
    }>;
    captureLead(input: LeadCaptureInput): Promise<Lead>;
    private capture;
    private persistCapture;
    private identityDiff;
    private recordIdentityChange;
    private splitDomain;
    private runAutomation;
    private normalizeInput;
    updateStatusByContact(organizationId: string, status: string, email?: string | null, phone?: string | null, clientId?: string): Promise<Lead | null>;
    private findExistingLead;
    private qualifyLead;
    private isGenericEmail;
    private buildRetentionReviewDate;
}
export {};
