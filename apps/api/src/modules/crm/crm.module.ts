import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../core/audit/audit.module';
import { ProcessTemplatesModule } from '../process-templates/process-templates.module';
import { AccountAccessModule } from '../../core/client-scope/account-access.module';
import { Lead } from './leads/lead.entity';
import { LeadController } from './leads/lead.controller';
import { CreateLeadUseCase } from './leads/use-cases/create-lead.use-case';
import { ListLeadsUseCase } from './leads/use-cases/list-leads.use-case';
import { ConvertLeadUseCase } from './leads/use-cases/convert-lead.use-case';
import { UpdateLeadUseCase } from './leads/use-cases/update-lead.use-case';
import { GetLeadUseCase } from './leads/use-cases/get-lead.use-case';
import { LeadIntakeService } from './leads/lead-intake.service';
import { LeadIngestService } from './leads/lead-ingest.service';
import { LeadIngestController } from './leads/lead-ingest.controller';
import { CrmHomeService } from './leads/crm-home.service';
import { CrmHomeController } from './leads/crm-home.controller';
import { IngestSourcesController } from './leads/ingest-sources.controller';
import { LeadIngestSource } from './leads/ingest-source.entity';
import { ImportLeadsUseCase } from './leads/use-cases/import-leads.use-case';
import { CrmLeadAutomationService } from './leads/crm-lead-automation.service';
import { Contact } from './contacts/contact.entity';
import { ContactsController } from './contacts/contacts.controller';
import { ContactsService } from './contacts/contacts.service';
import { PublicAgencyLeadsController } from './leads/public-agency-leads.controller';
import { Opportunity } from './opportunities/opportunity.entity';
import { OpportunityStageChange } from './opportunities/opportunity-stage-change.entity';
import { OpportunityStageHistoryService } from './opportunities/opportunity-stage-history.service';
import { OpportunitiesController } from './opportunities/opportunities.controller';
import { OpportunityReferenceValidator } from './opportunities/opportunity-reference-validator.service';
import { CreateOpportunityUseCase } from './opportunities/use-cases/create-opportunity.use-case';
import { ListOpportunitiesUseCase } from './opportunities/use-cases/list-opportunities.use-case';
import { GetOpportunityUseCase } from './opportunities/use-cases/get-opportunity.use-case';
import { UpdateOpportunityUseCase } from './opportunities/use-cases/update-opportunity.use-case';
import { RemoveOpportunityUseCase } from './opportunities/use-cases/remove-opportunity.use-case';
import { Interaction } from './interactions/interaction.entity';
import { User } from '../users/user.entity';
import { InteractionsController } from './interactions/interactions.controller';
import { InteractionsService } from './interactions/interactions.service';
import { Client } from '../clients/client.entity';
import { Reservation } from '../reservations/domain/reservation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Lead, Contact, Opportunity, OpportunityStageChange, Interaction, User, Client, Reservation, LeadIngestSource]), AccountAccessModule, AuditModule, ProcessTemplatesModule],
  controllers: [LeadController, ContactsController, OpportunitiesController, InteractionsController, PublicAgencyLeadsController, LeadIngestController, CrmHomeController, IngestSourcesController],
  providers: [
    CreateLeadUseCase, ListLeadsUseCase, GetLeadUseCase, ConvertLeadUseCase, UpdateLeadUseCase, ImportLeadsUseCase, LeadIntakeService, LeadIngestService, CrmHomeService, CrmLeadAutomationService,
    ContactsService,
    OpportunityReferenceValidator, OpportunityStageHistoryService, CreateOpportunityUseCase, ListOpportunitiesUseCase, GetOpportunityUseCase, UpdateOpportunityUseCase, RemoveOpportunityUseCase,
    InteractionsService,
  ],
  exports: [LeadIntakeService, CrmLeadAutomationService],
})
export class CrmModule {}
