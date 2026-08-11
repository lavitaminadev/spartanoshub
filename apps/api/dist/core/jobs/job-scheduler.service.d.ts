import { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { CloseXpPeriodsJob } from './cron/close-xp-periods.job';
import { CreateMonthlyCyclesJob } from './cron/create-monthly-cycles.job';
import { DetectStalePiecesJob } from './cron/detect-stale-pieces.job';
import { CollectionEmailsJob } from './cron/collection-emails.job';
import { PurgeExpiredLeadsJob } from './cron/purge-expired-leads.job';
import { MetaLeadRecoveryJob } from './cron/meta-lead-recovery.job';
import { MetaConversionOutboxService } from '../../modules/integrations/meta/meta-conversion-outbox.service';
import { OperationalAlertsJob } from './cron/operational-alerts.job';
export declare class JobSchedulerService implements OnModuleInit, OnApplicationShutdown {
    private readonly xp;
    private readonly cycles;
    private readonly stale;
    private readonly collections;
    private readonly purge;
    private readonly metaRecovery;
    private readonly capiOutbox;
    private readonly operationalAlerts;
    private readonly logger;
    private readonly timers;
    private running;
    constructor(xp: CloseXpPeriodsJob, cycles: CreateMonthlyCyclesJob, stale: DetectStalePiecesJob, collections: CollectionEmailsJob, purge: PurgeExpiredLeadsJob, metaRecovery: MetaLeadRecoveryJob, capiOutbox: MetaConversionOutboxService, operationalAlerts: OperationalAlertsJob);
    onModuleInit(): void;
    onApplicationShutdown(): void;
    private schedule;
}
