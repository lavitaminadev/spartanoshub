"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var JobSchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobSchedulerService = void 0;
const common_1 = require("@nestjs/common");
const close_xp_periods_job_1 = require("./cron/close-xp-periods.job");
const create_monthly_cycles_job_1 = require("./cron/create-monthly-cycles.job");
const detect_stale_pieces_job_1 = require("./cron/detect-stale-pieces.job");
const collection_emails_job_1 = require("./cron/collection-emails.job");
const purge_expired_leads_job_1 = require("./cron/purge-expired-leads.job");
const meta_lead_recovery_job_1 = require("./cron/meta-lead-recovery.job");
const meta_conversion_outbox_service_1 = require("../../modules/integrations/meta/meta-conversion-outbox.service");
const google_conversion_outbox_service_1 = require("../../modules/integrations/google/google-conversion-outbox.service");
const operational_alerts_job_1 = require("./cron/operational-alerts.job");
const automation_runner_service_1 = require("../../modules/automations/automation-runner.service");
const automation_schedule_job_1 = require("../../modules/automations/automation-schedule.job");
const webhook_delivery_service_1 = require("../../modules/automations/webhook-delivery.service");
let JobSchedulerService = JobSchedulerService_1 = class JobSchedulerService {
    constructor(xp, cycles, stale, collections, purge, metaRecovery, capiOutbox, googleOutbox, operationalAlerts, automations, automationSchedule, webhooks) {
        this.xp = xp;
        this.cycles = cycles;
        this.stale = stale;
        this.collections = collections;
        this.purge = purge;
        this.metaRecovery = metaRecovery;
        this.capiOutbox = capiOutbox;
        this.googleOutbox = googleOutbox;
        this.operationalAlerts = operationalAlerts;
        this.automations = automations;
        this.automationSchedule = automationSchedule;
        this.webhooks = webhooks;
        this.logger = new common_1.Logger(JobSchedulerService_1.name);
        this.timers = [];
        this.running = new Set();
    }
    onModuleInit() {
        if (process.env.ENABLE_INTERNAL_SCHEDULER !== 'true') {
            this.logger.log('Internal scheduler disabled; use hosting cron or set ENABLE_INTERNAL_SCHEDULER=true');
            return;
        }
        this.schedule('meta-lead-recovery', 15 * 60_000, () => this.metaRecovery.handle());
        this.schedule('meta-capi-outbox', 5 * 60_000, () => this.capiOutbox.processPending());
        this.schedule('google-ads-outbox', 5 * 60_000, () => this.googleOutbox.processPending());
        this.schedule('automation-runs', 60_000, () => this.automations.processPending());
        this.schedule('automation-cleanup', 24 * 60 * 60_000, () => this.automations.cleanup());
        this.schedule('automation-schedule', 60 * 60_000, () => this.automationSchedule.handle());
        this.schedule('automation-webhooks', 60_000, () => this.webhooks.processPending());
        this.schedule('automation-webhooks-cleanup', 24 * 60 * 60_000, () => this.webhooks.cleanup());
        this.schedule('stale-pieces', 60 * 60_000, () => this.stale.handle());
        this.schedule('operational-alerts', 60 * 60_000, () => this.operationalAlerts.handle(), true);
        this.schedule('monthly-cycles', 24 * 60 * 60_000, () => this.cycles.handle(), true);
        this.schedule('collection-emails', 24 * 60 * 60_000, () => this.collections.handle());
        this.schedule('data-retention', 24 * 60 * 60_000, () => this.purge.handle());
        this.schedule('xp-periods', 6 * 60 * 60_000, () => this.xp.handle());
    }
    onApplicationShutdown() { for (const timer of this.timers)
        clearInterval(timer); }
    schedule(name, interval, task, runAtStartup = false) {
        const run = async () => {
            if (this.running.has(name))
                return;
            this.running.add(name);
            try {
                await task();
            }
            catch (error) {
                this.logger.error(`${name} failed`, error instanceof Error ? error.stack : undefined);
            }
            finally {
                this.running.delete(name);
            }
        };
        if (runAtStartup)
            void run();
        const timer = setInterval(() => void run(), interval);
        timer.unref();
        this.timers.push(timer);
    }
};
exports.JobSchedulerService = JobSchedulerService;
exports.JobSchedulerService = JobSchedulerService = JobSchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [close_xp_periods_job_1.CloseXpPeriodsJob,
        create_monthly_cycles_job_1.CreateMonthlyCyclesJob,
        detect_stale_pieces_job_1.DetectStalePiecesJob,
        collection_emails_job_1.CollectionEmailsJob,
        purge_expired_leads_job_1.PurgeExpiredLeadsJob,
        meta_lead_recovery_job_1.MetaLeadRecoveryJob,
        meta_conversion_outbox_service_1.MetaConversionOutboxService,
        google_conversion_outbox_service_1.GoogleConversionOutboxService,
        operational_alerts_job_1.OperationalAlertsJob,
        automation_runner_service_1.AutomationRunnerService,
        automation_schedule_job_1.AutomationScheduleJob,
        webhook_delivery_service_1.WebhookDeliveryService])
], JobSchedulerService);
