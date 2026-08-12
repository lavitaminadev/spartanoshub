"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const xp_period_entity_1 = require("../../modules/gamification/xp-period.entity");
const xp_event_entity_1 = require("../../modules/gamification/xp-event.entity");
const client_entity_1 = require("../../modules/clients/client.entity");
const ud_budget_entity_1 = require("../../modules/design-budget/ud-budget.entity");
const piece_entity_1 = require("../../modules/production/piece.entity");
const notification_entity_1 = require("../notifications/notification.entity");
const invoice_entity_1 = require("../../modules/billing/invoice.entity");
const email_module_1 = require("../notifications/email.module");
const close_xp_periods_job_1 = require("./cron/close-xp-periods.job");
const create_monthly_cycles_job_1 = require("./cron/create-monthly-cycles.job");
const detect_stale_pieces_job_1 = require("./cron/detect-stale-pieces.job");
const collection_emails_job_1 = require("./cron/collection-emails.job");
const purge_expired_leads_job_1 = require("./cron/purge-expired-leads.job");
const meta_lead_recovery_job_1 = require("./cron/meta-lead-recovery.job");
const lead_entity_1 = require("../../modules/crm/leads/lead.entity");
const integration_account_entity_1 = require("../../modules/integrations/integration-account.entity");
const data_protection_module_1 = require("../data-protection/data-protection.module");
const meta_module_1 = require("../../modules/integrations/meta/meta.module");
const account_cycles_module_1 = require("../../modules/account-cycles/account-cycles.module");
const job_scheduler_service_1 = require("./job-scheduler.service");
const parameters_module_1 = require("../parameters/parameters.module");
const operational_alerts_job_1 = require("./cron/operational-alerts.job");
const recover_reservation_integrations_job_1 = require("./cron/recover-reservation-integrations.job");
const reservation_entity_1 = require("../../modules/reservations/domain/reservation.entity");
const reservation_form_entity_1 = require("../../modules/reservations/domain/reservation-form.entity");
const google_module_1 = require("../../modules/integrations/google/google.module");
const crm_module_1 = require("../../modules/crm/crm.module");
let JobsModule = class JobsModule {
};
exports.JobsModule = JobsModule;
exports.JobsModule = JobsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([xp_period_entity_1.XPPeriod, xp_event_entity_1.XPEvent, client_entity_1.Client, ud_budget_entity_1.UDBudget, piece_entity_1.Piece, notification_entity_1.Notification, invoice_entity_1.Invoice, lead_entity_1.Lead, integration_account_entity_1.IntegrationAccount, reservation_entity_1.Reservation, reservation_form_entity_1.ReservationForm]), email_module_1.EmailModule, data_protection_module_1.DataProtectionModule, meta_module_1.MetaModule, account_cycles_module_1.AccountCyclesModule, parameters_module_1.ParametersModule, google_module_1.GoogleModule, crm_module_1.CrmModule],
        providers: [close_xp_periods_job_1.CloseXpPeriodsJob, create_monthly_cycles_job_1.CreateMonthlyCyclesJob, detect_stale_pieces_job_1.DetectStalePiecesJob, collection_emails_job_1.CollectionEmailsJob, purge_expired_leads_job_1.PurgeExpiredLeadsJob, meta_lead_recovery_job_1.MetaLeadRecoveryJob, operational_alerts_job_1.OperationalAlertsJob, recover_reservation_integrations_job_1.RecoverReservationIntegrationsJob, job_scheduler_service_1.JobSchedulerService],
        exports: [close_xp_periods_job_1.CloseXpPeriodsJob, create_monthly_cycles_job_1.CreateMonthlyCyclesJob, detect_stale_pieces_job_1.DetectStalePiecesJob, collection_emails_job_1.CollectionEmailsJob, purge_expired_leads_job_1.PurgeExpiredLeadsJob, meta_lead_recovery_job_1.MetaLeadRecoveryJob, operational_alerts_job_1.OperationalAlertsJob, recover_reservation_integrations_job_1.RecoverReservationIntegrationsJob],
    })
], JobsModule);
//# sourceMappingURL=jobs.module.js.map