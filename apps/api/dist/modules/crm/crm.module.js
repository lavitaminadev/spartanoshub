"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrmModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const audit_module_1 = require("../../core/audit/audit.module");
const process_templates_module_1 = require("../process-templates/process-templates.module");
const account_access_module_1 = require("../../core/client-scope/account-access.module");
const lead_entity_1 = require("./leads/lead.entity");
const lead_controller_1 = require("./leads/lead.controller");
const create_lead_use_case_1 = require("./leads/use-cases/create-lead.use-case");
const list_leads_use_case_1 = require("./leads/use-cases/list-leads.use-case");
const convert_lead_use_case_1 = require("./leads/use-cases/convert-lead.use-case");
const update_lead_use_case_1 = require("./leads/use-cases/update-lead.use-case");
const get_lead_use_case_1 = require("./leads/use-cases/get-lead.use-case");
const lead_intake_service_1 = require("./leads/lead-intake.service");
const lead_ingest_service_1 = require("./leads/lead-ingest.service");
const lead_ingest_controller_1 = require("./leads/lead-ingest.controller");
const crm_home_service_1 = require("./leads/crm-home.service");
const crm_dashboard_service_1 = require("./leads/crm-dashboard.service");
const crm_home_controller_1 = require("./leads/crm-home.controller");
const ingest_sources_controller_1 = require("./leads/ingest-sources.controller");
const ingest_source_entity_1 = require("./leads/ingest-source.entity");
const import_leads_use_case_1 = require("./leads/use-cases/import-leads.use-case");
const crm_lead_automation_service_1 = require("./leads/crm-lead-automation.service");
const contact_entity_1 = require("./contacts/contact.entity");
const contacts_controller_1 = require("./contacts/contacts.controller");
const contacts_service_1 = require("./contacts/contacts.service");
const public_agency_leads_controller_1 = require("./leads/public-agency-leads.controller");
const opportunity_entity_1 = require("./opportunities/opportunity.entity");
const opportunity_stage_change_entity_1 = require("./opportunities/opportunity-stage-change.entity");
const opportunity_stage_history_service_1 = require("./opportunities/opportunity-stage-history.service");
const opportunities_controller_1 = require("./opportunities/opportunities.controller");
const opportunity_reference_validator_service_1 = require("./opportunities/opportunity-reference-validator.service");
const create_opportunity_use_case_1 = require("./opportunities/use-cases/create-opportunity.use-case");
const list_opportunities_use_case_1 = require("./opportunities/use-cases/list-opportunities.use-case");
const get_opportunity_use_case_1 = require("./opportunities/use-cases/get-opportunity.use-case");
const update_opportunity_use_case_1 = require("./opportunities/use-cases/update-opportunity.use-case");
const remove_opportunity_use_case_1 = require("./opportunities/use-cases/remove-opportunity.use-case");
const interaction_entity_1 = require("./interactions/interaction.entity");
const user_entity_1 = require("../users/user.entity");
const interactions_controller_1 = require("./interactions/interactions.controller");
const interactions_service_1 = require("./interactions/interactions.service");
const client_entity_1 = require("../clients/client.entity");
const reservation_entity_1 = require("../reservations/domain/reservation.entity");
let CrmModule = class CrmModule {
};
exports.CrmModule = CrmModule;
exports.CrmModule = CrmModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([lead_entity_1.Lead, contact_entity_1.Contact, opportunity_entity_1.Opportunity, opportunity_stage_change_entity_1.OpportunityStageChange, interaction_entity_1.Interaction, user_entity_1.User, client_entity_1.Client, reservation_entity_1.Reservation, ingest_source_entity_1.LeadIngestSource]), account_access_module_1.AccountAccessModule, audit_module_1.AuditModule, process_templates_module_1.ProcessTemplatesModule],
        controllers: [lead_controller_1.LeadController, contacts_controller_1.ContactsController, opportunities_controller_1.OpportunitiesController, interactions_controller_1.InteractionsController, public_agency_leads_controller_1.PublicAgencyLeadsController, lead_ingest_controller_1.LeadIngestController, crm_home_controller_1.CrmHomeController, ingest_sources_controller_1.IngestSourcesController],
        providers: [
            create_lead_use_case_1.CreateLeadUseCase, list_leads_use_case_1.ListLeadsUseCase, get_lead_use_case_1.GetLeadUseCase, convert_lead_use_case_1.ConvertLeadUseCase, update_lead_use_case_1.UpdateLeadUseCase, import_leads_use_case_1.ImportLeadsUseCase, lead_intake_service_1.LeadIntakeService, lead_ingest_service_1.LeadIngestService, crm_home_service_1.CrmHomeService, crm_dashboard_service_1.CrmDashboardService, crm_lead_automation_service_1.CrmLeadAutomationService,
            contacts_service_1.ContactsService,
            opportunity_reference_validator_service_1.OpportunityReferenceValidator, opportunity_stage_history_service_1.OpportunityStageHistoryService, create_opportunity_use_case_1.CreateOpportunityUseCase, list_opportunities_use_case_1.ListOpportunitiesUseCase, get_opportunity_use_case_1.GetOpportunityUseCase, update_opportunity_use_case_1.UpdateOpportunityUseCase, remove_opportunity_use_case_1.RemoveOpportunityUseCase,
            interactions_service_1.InteractionsService,
        ],
        exports: [lead_intake_service_1.LeadIntakeService, crm_lead_automation_service_1.CrmLeadAutomationService],
    })
], CrmModule);
