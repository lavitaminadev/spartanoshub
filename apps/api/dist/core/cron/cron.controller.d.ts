import { MetaConversionOutboxService } from '../../modules/integrations/meta/meta-conversion-outbox.service';
import { GoogleConversionOutboxService } from '../../modules/integrations/google/google-conversion-outbox.service';
import { DetectStalePiecesJob } from '../jobs/cron/detect-stale-pieces.job';
import { OperationalAlertsJob } from '../jobs/cron/operational-alerts.job';
import { CreateMonthlyCyclesJob } from '../jobs/cron/create-monthly-cycles.job';
import { CollectionEmailsJob } from '../jobs/cron/collection-emails.job';
import { PurgeExpiredLeadsJob } from '../jobs/cron/purge-expired-leads.job';
import { RecoverReservationIntegrationsJob } from '../jobs/cron/recover-reservation-integrations.job';
import { CloseXpPeriodsJob } from '../jobs/cron/close-xp-periods.job';
export declare class CronController {
    private readonly capiOutbox;
    private readonly googleOutbox;
    private readonly stale;
    private readonly operationalAlerts;
    private readonly cycles;
    private readonly collections;
    private readonly purge;
    private readonly reservationIntegrations;
    private readonly xp;
    private readonly running;
    constructor(capiOutbox: MetaConversionOutboxService, googleOutbox: GoogleConversionOutboxService, stale: DetectStalePiecesJob, operationalAlerts: OperationalAlertsJob, cycles: CreateMonthlyCyclesJob, collections: CollectionEmailsJob, purge: PurgeExpiredLeadsJob, reservationIntegrations: RecoverReservationIntegrationsJob, xp: CloseXpPeriodsJob);
    private verifySecret;
    processMetaCapiPost(secret: string, limit?: number): Promise<{
        ok: boolean;
        skipped: string;
        processed?: undefined;
        failed?: undefined;
        timestamp?: undefined;
    } | {
        ok: boolean;
        processed: number;
        failed: number;
        timestamp: string;
        skipped?: undefined;
    }>;
    processMetaCapi(secret: string): Promise<{
        ok: boolean;
        skipped: string;
        processed?: undefined;
        failed?: undefined;
        timestamp?: undefined;
    } | {
        ok: boolean;
        processed: number;
        failed: number;
        timestamp: string;
        skipped?: undefined;
    }>;
    private runMetaCapi;
    capiDiagnostics(secret: string): Promise<{
        timestamp: string;
        pending: number;
        retry: number;
        processing: number;
        failed: number;
        expired: number;
        processed: number;
        total: number;
        ok: boolean;
    }>;
    processGoogleAdsPost(secret: string, limit?: number): Promise<{
        ok: boolean;
        skipped: string;
        processed?: undefined;
        failed?: undefined;
        timestamp?: undefined;
    } | {
        ok: boolean;
        processed: number;
        failed: number;
        timestamp: string;
        skipped?: undefined;
    }>;
    processGoogleAds(secret: string): Promise<{
        ok: boolean;
        skipped: string;
        processed?: undefined;
        failed?: undefined;
        timestamp?: undefined;
    } | {
        ok: boolean;
        processed: number;
        failed: number;
        timestamp: string;
        skipped?: undefined;
    }>;
    private runGoogleAds;
    googleAdsDiagnostics(secret: string): Promise<{
        timestamp: string;
        pending: number;
        retry: number;
        processing: number;
        failed: number;
        processed: number;
        total: number;
        ok: boolean;
    }>;
    cleanupOutbox(secret: string, olderThanDays?: number): Promise<{
        timestamp: string;
        deleted: number;
        ok: boolean;
    }>;
    private runLocked;
    processStalePiecesPost(secret: string): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        timestamp: string;
        ok: boolean;
        skipped?: undefined;
    }>;
    processStalePieces(secret: string): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        timestamp: string;
        ok: boolean;
        skipped?: undefined;
    }>;
    processOperationalAlertsPost(secret: string): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        timestamp: string;
        ok: boolean;
        skipped?: undefined;
    }>;
    processOperationalAlerts(secret: string): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        timestamp: string;
        ok: boolean;
        skipped?: undefined;
    }>;
    processMonthlyCyclesPost(secret: string): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        timestamp: string;
        ok: boolean;
        skipped?: undefined;
    }>;
    processMonthlyCycles(secret: string): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        timestamp: string;
        ok: boolean;
        skipped?: undefined;
    }>;
    processCollectionEmailsPost(secret: string): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        timestamp: string;
        ok: boolean;
        skipped?: undefined;
    }>;
    processCollectionEmails(secret: string): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        timestamp: string;
        ok: boolean;
        skipped?: undefined;
    }>;
    processDataRetentionPost(secret: string): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        timestamp: string;
        ok: boolean;
        skipped?: undefined;
    }>;
    processDataRetention(secret: string): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        timestamp: string;
        ok: boolean;
        skipped?: undefined;
    }>;
    recoverReservationIntegrationsPost(secret: string): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        timestamp: string;
        ok: boolean;
        skipped?: undefined;
    }>;
    recoverReservationIntegrations(secret: string): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        timestamp: string;
        ok: boolean;
        skipped?: undefined;
    }>;
    processXpPeriodsPost(secret: string): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        timestamp: string;
        ok: boolean;
        skipped?: undefined;
    }>;
    processXpPeriods(secret: string): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        timestamp: string;
        ok: boolean;
        skipped?: undefined;
    }>;
}
