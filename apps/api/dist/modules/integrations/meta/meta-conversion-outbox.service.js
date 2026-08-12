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
var MetaConversionOutboxService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaConversionOutboxService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const meta_conversions_service_1 = require("./meta-conversions.service");
const meta_conversion_outbox_entity_1 = require("./meta-conversion-outbox.entity");
const meta_client_pixel_service_1 = require("./meta-client-pixel.service");
const CLAIM_TIMEOUT_MS = 10 * 60_000;
const MAX_AGE_DAYS_BY_ACTION_SOURCE = {
    physical_store: 62,
};
const DEFAULT_MAX_AGE_DAYS = 7;
const META_OAUTH_ERROR_CODE = 190;
const TERMINAL_STATUSES = ['failed', 'expired'];
let MetaConversionOutboxService = MetaConversionOutboxService_1 = class MetaConversionOutboxService {
    constructor(outbox, conversions, clientPixels) {
        this.outbox = outbox;
        this.conversions = conversions;
        this.clientPixels = clientPixels;
        this.logger = new common_1.Logger(MetaConversionOutboxService_1.name);
    }
    async enqueue(organizationId, pixelId, event) {
        const eventId = event.eventId;
        if (!eventId)
            throw new Error('A stable eventId is required for Meta CAPI');
        const existing = await this.outbox.findOne({ where: { organizationId, eventId } });
        if (existing)
            return existing;
        return this.outbox.save(this.outbox.create({ organizationId, pixelId, eventId, eventData: event }));
    }
    async stats(organizationId) {
        const scope = organizationId ? { organizationId } : {};
        const countBy = (status) => this.outbox.count({ where: status ? { ...scope, status } : scope });
        const [pending, retry, processing, failed, expired, processed, total] = await Promise.all([
            countBy('pending'),
            countBy('retry'),
            countBy('processing'),
            countBy('failed'),
            countBy('expired'),
            countBy('processed'),
            countBy(),
        ]);
        return { pending, retry, processing, failed, expired, processed, total };
    }
    async recentProblems(organizationId, limit = 20) {
        return this.outbox.find({
            where: [
                { organizationId, status: 'failed' },
                { organizationId, status: 'expired' },
                { organizationId, status: 'retry' },
            ],
            order: { updatedAt: 'DESC' },
            take: Math.min(Math.max(limit, 1), 100),
        });
    }
    async releaseStaleClaims(manager, staleBefore) {
        await manager.getRepository(meta_conversion_outbox_entity_1.MetaConversionOutbox)
            .createQueryBuilder()
            .update()
            .set({ status: 'retry' })
            .where('status = :status AND updated_at <= :staleBefore', { status: 'processing', staleBefore })
            .execute();
    }
    async claimBatch(limit) {
        const now = new Date();
        return this.outbox.manager.transaction(async (manager) => {
            await this.releaseStaleClaims(manager, new Date(now.getTime() - CLAIM_TIMEOUT_MS));
            const repository = manager.getRepository(meta_conversion_outbox_entity_1.MetaConversionOutbox);
            const items = await repository.find({
                where: [
                    { status: (0, typeorm_2.In)(['pending', 'retry']), nextAttemptAt: (0, typeorm_2.IsNull)() },
                    { status: (0, typeorm_2.In)(['pending', 'retry']), nextAttemptAt: (0, typeorm_2.LessThanOrEqual)(now) },
                ],
                order: { createdAt: 'ASC' },
                take: limit,
                lock: { mode: 'pessimistic_write' },
            });
            if (items.length === 0)
                return [];
            await repository.update(items.map((item) => item.id), { status: 'processing' });
            return items;
        });
    }
    async processPending(limit = 25) {
        const items = await this.claimBatch(limit);
        let processed = 0;
        let failed = 0;
        for (const item of items) {
            try {
                const event = item.eventData;
                const eventTime = Number(event?.eventTime ?? 0);
                const maxAgeDays = MAX_AGE_DAYS_BY_ACTION_SOURCE[event?.actionSource ?? ''] ?? DEFAULT_MAX_AGE_DAYS;
                if (eventTime > 0 && Date.now() - eventTime * 1000 > maxAgeDays * 86_400_000) {
                    item.status = 'expired';
                    item.nextAttemptAt = undefined;
                    item.lastError = `El evento supera los ${maxAgeDays} días que acepta Meta para su origen y ya no puede atribuirse.`;
                    await this.outbox.save(item);
                    failed += 1;
                    continue;
                }
                const token = await this.clientPixels.resolveByPixel(item.organizationId, item.pixelId);
                if (!token)
                    throw new Error('Meta conversion token is unavailable');
                await this.conversions.sendServerEvent(item.pixelId, token, item.eventData);
                item.status = 'processed';
                item.processedAt = new Date();
                item.lastError = undefined;
                processed += 1;
            }
            catch (error) {
                const apiError = error;
                const statusCode = apiError?.response?.status;
                const isNonRetryable = typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500 && statusCode !== 429;
                const metaError = apiError?.response?.data?.error;
                const bodyMsg = metaError?.message ?? metaError?.error_user_msg ?? '';
                const isExpiredToken = metaError?.code === META_OAUTH_ERROR_CODE
                    || metaError?.type === 'OAuthException'
                    || /expired|invalid.*token|invalidated|revoked|unauthorized/i.test(bodyMsg);
                item.attempts += 1;
                if (isNonRetryable || isExpiredToken || item.attempts >= 8) {
                    item.status = 'failed';
                    item.nextAttemptAt = undefined;
                }
                else {
                    item.status = 'retry';
                    item.nextAttemptAt = new Date(Date.now() + Math.min(60, 2 ** item.attempts) * 60_000);
                }
                item.lastError = error instanceof Error ? error.message : 'Unknown CAPI error';
                if (statusCode)
                    item.lastError = `HTTP ${statusCode}: ${item.lastError}`;
                if (isExpiredToken)
                    item.lastError = `[TOKEN] ${item.lastError}`;
                failed += 1;
                this.logger.warn(`CAPI outbox ${item.id} failed${isNonRetryable || isExpiredToken ? ' (non-retryable)' : ''} (attempt ${item.attempts}): ${item.lastError}`);
            }
            await this.outbox.save(item);
        }
        return { processed, failed };
    }
    async cleanup(olderThanDays = 7) {
        const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60_000);
        const result = await this.outbox.delete({ status: 'processed', processedAt: (0, typeorm_2.LessThanOrEqual)(cutoff) });
        const terminalResult = await this.outbox.delete({ status: (0, typeorm_2.In)([...TERMINAL_STATUSES]), createdAt: (0, typeorm_2.LessThanOrEqual)(cutoff) });
        return { deleted: (result.affected ?? 0) + (terminalResult.affected ?? 0) };
    }
};
exports.MetaConversionOutboxService = MetaConversionOutboxService;
exports.MetaConversionOutboxService = MetaConversionOutboxService = MetaConversionOutboxService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(meta_conversion_outbox_entity_1.MetaConversionOutbox)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        meta_conversions_service_1.MetaConversionsService,
        meta_client_pixel_service_1.MetaClientPixelService])
], MetaConversionOutboxService);
//# sourceMappingURL=meta-conversion-outbox.service.js.map