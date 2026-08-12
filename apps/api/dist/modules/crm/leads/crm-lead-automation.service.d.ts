import { EntityManager, Repository } from 'typeorm';
import { Contact } from '../contacts/contact.entity';
import { Opportunity } from '../opportunities/opportunity.entity';
import { Interaction } from '../interactions/interaction.entity';
import { User } from '../../users/user.entity';
import { Lead } from './lead.entity';
export declare class CrmLeadAutomationService {
    private readonly contactsRepo;
    private readonly opportunitiesRepo;
    private readonly interactionsRepo;
    private readonly usersRepo;
    constructor(contactsRepo: Repository<Contact>, opportunitiesRepo: Repository<Opportunity>, interactionsRepo: Repository<Interaction>, usersRepo: Repository<User>);
    private static readonly AUDIENCE_SOURCES;
    runForLead(lead: Lead, manager?: EntityManager): Promise<void>;
    ensureAudienceContact(lead: Lead, manager?: EntityManager): Promise<Contact | null>;
    private isAudienceLead;
    private ensureContact;
    private ensureOpportunity;
    private ensureIntakeInteraction;
    private ensureQualifiedInteraction;
    private ensureDiscardInteraction;
    private resolveCommercialOwner;
    private buildExpectedCloseDate;
}
