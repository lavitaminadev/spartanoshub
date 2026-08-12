"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const event_emitter_1 = require("@nestjs/event-emitter");
const core_1 = require("@nestjs/core");
const audit_interceptor_1 = require("./core/audit/audit.interceptor");
const error_logging_interceptor_1 = require("./core/observability/error-logging.interceptor");
const errors_module_1 = require("./core/errors/errors.module");
const health_module_1 = require("./core/health/health.module");
const auth_module_1 = require("./core/auth/auth.module");
const organization_module_1 = require("./core/organization/organization.module");
const audit_module_1 = require("./core/audit/audit.module");
const authorization_module_1 = require("./core/authorization/authorization.module");
const events_module_1 = require("./core/events/events.module");
const jobs_module_1 = require("./core/jobs/jobs.module");
const parameters_module_1 = require("./core/parameters/parameters.module");
const notifications_module_1 = require("./core/notifications/notifications.module");
const observability_module_1 = require("./core/observability/observability.module");
const cloudinary_module_1 = require("./core/cloudinary/cloudinary.module");
const organizations_module_1 = require("./modules/organizations/organizations.module");
const users_module_1 = require("./modules/users/users.module");
const crm_module_1 = require("./modules/crm/crm.module");
const clients_module_1 = require("./modules/clients/clients.module");
const contracts_module_1 = require("./modules/contracts/contracts.module");
const catalog_module_1 = require("./modules/catalog/catalog.module");
const production_module_1 = require("./modules/production/production.module");
const design_budget_module_1 = require("./modules/design-budget/design-budget.module");
const gamification_module_1 = require("./modules/gamification/gamification.module");
const integrations_module_1 = require("./modules/integrations/integrations.module");
const meetings_module_1 = require("./modules/meetings/meetings.module");
const content_module_1 = require("./modules/content/content.module");
const reports_module_1 = require("./modules/reports/reports.module");
const billing_module_1 = require("./modules/billing/billing.module");
const approvals_module_1 = require("./modules/approvals/approvals.module");
const onboarding_module_1 = require("./modules/onboarding/onboarding.module");
const briefs_module_1 = require("./modules/briefs/briefs.module");
const documents_module_1 = require("./modules/documents/documents.module");
const dashboards_module_1 = require("./modules/dashboards/dashboards.module");
const meta_module_1 = require("./modules/integrations/meta/meta.module");
const google_module_1 = require("./modules/integrations/google/google.module");
const knowledge_module_1 = require("./modules/knowledge/knowledge.module");
const uploads_module_1 = require("./modules/uploads/uploads.module");
const operations_module_1 = require("./modules/operations/operations.module");
const audiovisual_module_1 = require("./modules/audiovisual/audiovisual.module");
const data_protection_module_1 = require("./core/data-protection/data-protection.module");
const account_cycles_module_1 = require("./modules/account-cycles/account-cycles.module");
const objectives_module_1 = require("./modules/objectives/objectives.module");
const reservations_module_1 = require("./modules/reservations/reservations.module");
const account_access_module_1 = require("./core/client-scope/account-access.module");
const cron_module_1 = require("./core/cron/cron.module");
const workflows_module_1 = require("./modules/workflows/workflows.module");
const pods_module_1 = require("./modules/pods/pods.module");
const intake_module_1 = require("./modules/intake/intake.module");
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USERNAME = process.env.DB_USERNAME || 'espartanos';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_DATABASE = process.env.DB_DATABASE || 'espartanos';
const DB_CONNECTION_LIMIT = Math.max(1, parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10) || 10);
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'mysql',
                host: DB_HOST,
                port: DB_PORT,
                username: DB_USERNAME,
                password: DB_PASSWORD,
                database: DB_DATABASE,
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
                migrations: [__dirname + '/infrastructure/migrations/*{.ts,.js}'],
                synchronize: false,
                logging: process.env.DB_LOGGING === 'true',
                extra: {
                    charset: 'utf8mb4_unicode_ci',
                    connectionLimit: DB_CONNECTION_LIMIT,
                    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
                },
            }),
            throttler_1.ThrottlerModule.forRoot([{
                    ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
                    limit: Number(process.env.THROTTLE_LIMIT ?? 100),
                }]),
            event_emitter_1.EventEmitterModule.forRoot(),
            errors_module_1.ErrorsModule,
            health_module_1.HealthModule,
            auth_module_1.AuthModule,
            organization_module_1.OrganizationModule,
            account_access_module_1.AccountAccessModule,
            audit_module_1.AuditModule,
            events_module_1.EventsModule,
            jobs_module_1.JobsModule,
            parameters_module_1.ParametersModule,
            notifications_module_1.NotificationsModule,
            observability_module_1.ObservabilityModule,
            cloudinary_module_1.CloudinaryModule,
            organizations_module_1.OrganizationsModule,
            users_module_1.UsersModule,
            crm_module_1.CrmModule,
            clients_module_1.ClientsModule,
            contracts_module_1.ContractsModule,
            catalog_module_1.CatalogModule,
            production_module_1.ProductionModule,
            design_budget_module_1.DesignBudgetModule,
            gamification_module_1.GamificationModule,
            integrations_module_1.IntegrationsModule,
            meetings_module_1.MeetingsModule,
            content_module_1.ContentModule,
            reports_module_1.ReportsModule,
            billing_module_1.BillingModule,
            approvals_module_1.ApprovalsModule,
            onboarding_module_1.OnboardingModule,
            briefs_module_1.BriefsModule,
            documents_module_1.DocumentsModule,
            dashboards_module_1.DashboardsModule,
            meta_module_1.MetaModule,
            google_module_1.GoogleModule,
            knowledge_module_1.KnowledgeModule,
            uploads_module_1.UploadsModule,
            operations_module_1.OperationsModule,
            audiovisual_module_1.AudiovisualModule,
            data_protection_module_1.DataProtectionModule,
            account_cycles_module_1.AccountCyclesModule,
            objectives_module_1.ObjectivesModule,
            reservations_module_1.ReservationsModule,
            workflows_module_1.WorkflowsModule,
            pods_module_1.PodsModule,
            intake_module_1.IntakeModule,
            cron_module_1.CronModule,
            authorization_module_1.AuthorizationModule,
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
            { provide: core_1.APP_INTERCEPTOR, useClass: error_logging_interceptor_1.ErrorLoggingInterceptor },
            { provide: core_1.APP_INTERCEPTOR, useClass: audit_interceptor_1.AuditInterceptor },
        ],
    })
], AppModule);
