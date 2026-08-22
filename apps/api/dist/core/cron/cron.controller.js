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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const crypto_1 = require("crypto");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const meta_conversion_outbox_service_1 = require("../../modules/integrations/meta/meta-conversion-outbox.service");
const google_conversion_outbox_service_1 = require("../../modules/integrations/google/google-conversion-outbox.service");
const detect_stale_pieces_job_1 = require("../jobs/cron/detect-stale-pieces.job");
const operational_alerts_job_1 = require("../jobs/cron/operational-alerts.job");
const create_monthly_cycles_job_1 = require("../jobs/cron/create-monthly-cycles.job");
const collection_emails_job_1 = require("../jobs/cron/collection-emails.job");
const purge_expired_leads_job_1 = require("../jobs/cron/purge-expired-leads.job");
const recover_reservation_integrations_job_1 = require("../jobs/cron/recover-reservation-integrations.job");
const close_xp_periods_job_1 = require("../jobs/cron/close-xp-periods.job");
let CronController = class CronController {
    constructor(capiOutbox, googleOutbox, stale, operationalAlerts, cycles, collections, purge, reservationIntegrations, xp) {
        this.capiOutbox = capiOutbox;
        this.googleOutbox = googleOutbox;
        this.stale = stale;
        this.operationalAlerts = operationalAlerts;
        this.cycles = cycles;
        this.collections = collections;
        this.purge = purge;
        this.reservationIntegrations = reservationIntegrations;
        this.xp = xp;
        this.running = new Set();
    }
    verifySecret(secret) {
        const vigente = process.env.CRON_SECRET;
        if (!vigente)
            throw new common_1.ForbiddenException('CRON_SECRET not configured');
        const anterior = process.env.CRON_SECRET_PREVIOUS;
        const candidatas = anterior ? [vigente, anterior] : [vigente];
        const recibida = Buffer.from(secret ?? '');
        const coincide = candidatas.some((clave) => {
            const esperada = Buffer.from(clave);
            return recibida.length === esperada.length && (0, crypto_1.timingSafeEqual)(recibida, esperada);
        });
        if (!coincide)
            throw new common_1.ForbiddenException('Invalid cron secret');
    }
    async processMetaCapiPost(secret, limit) {
        this.verifySecret(secret);
        return this.runMetaCapi(limit);
    }
    async processMetaCapi(secret) {
        this.verifySecret(secret);
        return this.runMetaCapi();
    }
    async runMetaCapi(limit) {
        const lockKey = 'meta-capi';
        if (this.running.has(lockKey))
            return { ok: true, skipped: 'already_running' };
        this.running.add(lockKey);
        try {
            const result = await this.capiOutbox.processPending(limit ?? 50);
            return { ok: true, processed: result.processed, failed: result.failed, timestamp: new Date().toISOString() };
        }
        finally {
            this.running.delete(lockKey);
        }
    }
    async capiDiagnostics(secret) {
        this.verifySecret(secret);
        const stats = await this.capiOutbox.stats();
        return { ok: true, ...stats, timestamp: new Date().toISOString() };
    }
    async processGoogleAdsPost(secret, limit) {
        this.verifySecret(secret);
        return this.runGoogleAds(limit);
    }
    async processGoogleAds(secret) {
        this.verifySecret(secret);
        return this.runGoogleAds();
    }
    async runGoogleAds(limit) {
        const lockKey = 'google-ads';
        if (this.running.has(lockKey))
            return { ok: true, skipped: 'already_running' };
        this.running.add(lockKey);
        try {
            const result = await this.googleOutbox.processPending(limit ?? 50);
            return { ok: true, processed: result.processed, failed: result.failed, timestamp: new Date().toISOString() };
        }
        finally {
            this.running.delete(lockKey);
        }
    }
    async googleAdsDiagnostics(secret) {
        this.verifySecret(secret);
        const stats = await this.googleOutbox.stats();
        return { ok: true, ...stats, timestamp: new Date().toISOString() };
    }
    async cleanupOutbox(secret, olderThanDays) {
        this.verifySecret(secret);
        const result = await this.capiOutbox.cleanup(olderThanDays ?? 7);
        return { ok: true, ...result, timestamp: new Date().toISOString() };
    }
    async runLocked(lockKey, task) {
        if (this.running.has(lockKey))
            return { ok: true, skipped: 'already_running' };
        this.running.add(lockKey);
        try {
            const result = await task();
            return { ok: true, ...(result ?? {}), timestamp: new Date().toISOString() };
        }
        finally {
            this.running.delete(lockKey);
        }
    }
    async processStalePiecesPost(secret) {
        this.verifySecret(secret);
        return this.runLocked('stale-pieces', () => this.stale.handle());
    }
    async processStalePieces(secret) {
        this.verifySecret(secret);
        return this.runLocked('stale-pieces', () => this.stale.handle());
    }
    async processOperationalAlertsPost(secret) {
        this.verifySecret(secret);
        return this.runLocked('operational-alerts', () => this.operationalAlerts.handle());
    }
    async processOperationalAlerts(secret) {
        this.verifySecret(secret);
        return this.runLocked('operational-alerts', () => this.operationalAlerts.handle());
    }
    async processMonthlyCyclesPost(secret) {
        this.verifySecret(secret);
        return this.runLocked('monthly-cycles', () => this.cycles.handle());
    }
    async processMonthlyCycles(secret) {
        this.verifySecret(secret);
        return this.runLocked('monthly-cycles', () => this.cycles.handle());
    }
    async processCollectionEmailsPost(secret) {
        this.verifySecret(secret);
        return this.runLocked('collection-emails', () => this.collections.handle());
    }
    async processCollectionEmails(secret) {
        this.verifySecret(secret);
        return this.runLocked('collection-emails', () => this.collections.handle());
    }
    async processDataRetentionPost(secret) {
        this.verifySecret(secret);
        return this.runLocked('data-retention', () => this.purge.handle());
    }
    async processDataRetention(secret) {
        this.verifySecret(secret);
        return this.runLocked('data-retention', () => this.purge.handle());
    }
    async recoverReservationIntegrationsPost(secret) {
        this.verifySecret(secret);
        return this.runLocked('reservation-integrations', () => this.reservationIntegrations.handle());
    }
    async recoverReservationIntegrations(secret) {
        this.verifySecret(secret);
        return this.runLocked('reservation-integrations', () => this.reservationIntegrations.handle());
    }
    async processXpPeriodsPost(secret) {
        this.verifySecret(secret);
        return this.runLocked('xp-periods', () => this.xp.handle());
    }
    async processXpPeriods(secret) {
        this.verifySecret(secret);
        return this.runLocked('xp-periods', () => this.xp.handle());
    }
};
exports.CronController = CronController;
__decorate([
    (0, common_1.Post)('meta-capi'),
    (0, throttler_1.Throttle)({ default: { limit: 6, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __param(1, (0, common_1.Body)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processMetaCapiPost", null);
__decorate([
    (0, common_1.Get)('meta-capi'),
    (0, throttler_1.Throttle)({ default: { limit: 6, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processMetaCapi", null);
__decorate([
    (0, common_1.Get)('meta-capi/diagnostics'),
    (0, throttler_1.Throttle)({ default: { limit: 12, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "capiDiagnostics", null);
__decorate([
    (0, common_1.Post)('google-ads'),
    (0, throttler_1.Throttle)({ default: { limit: 6, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __param(1, (0, common_1.Body)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processGoogleAdsPost", null);
__decorate([
    (0, common_1.Get)('google-ads'),
    (0, throttler_1.Throttle)({ default: { limit: 6, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processGoogleAds", null);
__decorate([
    (0, common_1.Get)('google-ads/diagnostics'),
    (0, throttler_1.Throttle)({ default: { limit: 12, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "googleAdsDiagnostics", null);
__decorate([
    (0, common_1.Post)('meta-capi/cleanup'),
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __param(1, (0, common_1.Body)('olderThanDays')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "cleanupOutbox", null);
__decorate([
    (0, common_1.Post)('stale-pieces'),
    (0, throttler_1.Throttle)({ default: { limit: 6, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processStalePiecesPost", null);
__decorate([
    (0, common_1.Get)('stale-pieces'),
    (0, throttler_1.Throttle)({ default: { limit: 6, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processStalePieces", null);
__decorate([
    (0, common_1.Post)('operational-alerts'),
    (0, throttler_1.Throttle)({ default: { limit: 6, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processOperationalAlertsPost", null);
__decorate([
    (0, common_1.Get)('operational-alerts'),
    (0, throttler_1.Throttle)({ default: { limit: 6, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processOperationalAlerts", null);
__decorate([
    (0, common_1.Post)('monthly-cycles'),
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processMonthlyCyclesPost", null);
__decorate([
    (0, common_1.Get)('monthly-cycles'),
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processMonthlyCycles", null);
__decorate([
    (0, common_1.Post)('collection-emails'),
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processCollectionEmailsPost", null);
__decorate([
    (0, common_1.Get)('collection-emails'),
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processCollectionEmails", null);
__decorate([
    (0, common_1.Post)('data-retention'),
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processDataRetentionPost", null);
__decorate([
    (0, common_1.Get)('data-retention'),
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processDataRetention", null);
__decorate([
    (0, common_1.Post)('reservation-integrations'),
    (0, throttler_1.Throttle)({ default: { limit: 6, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "recoverReservationIntegrationsPost", null);
__decorate([
    (0, common_1.Get)('reservation-integrations'),
    (0, throttler_1.Throttle)({ default: { limit: 6, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "recoverReservationIntegrations", null);
__decorate([
    (0, common_1.Post)('xp-periods'),
    (0, throttler_1.Throttle)({ default: { limit: 6, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processXpPeriodsPost", null);
__decorate([
    (0, common_1.Get)('xp-periods'),
    (0, throttler_1.Throttle)({ default: { limit: 6, ttl: 60000 } }),
    __param(0, (0, common_1.Headers)('x-cron-secret')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronController.prototype, "processXpPeriods", null);
exports.CronController = CronController = __decorate([
    (0, common_1.Controller)('cron'),
    (0, public_decorator_1.Public)(),
    __metadata("design:paramtypes", [meta_conversion_outbox_service_1.MetaConversionOutboxService,
        google_conversion_outbox_service_1.GoogleConversionOutboxService,
        detect_stale_pieces_job_1.DetectStalePiecesJob,
        operational_alerts_job_1.OperationalAlertsJob,
        create_monthly_cycles_job_1.CreateMonthlyCyclesJob,
        collection_emails_job_1.CollectionEmailsJob,
        purge_expired_leads_job_1.PurgeExpiredLeadsJob,
        recover_reservation_integrations_job_1.RecoverReservationIntegrationsJob,
        close_xp_periods_job_1.CloseXpPeriodsJob])
], CronController);
