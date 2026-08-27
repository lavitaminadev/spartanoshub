"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxProcessor = void 0;
const typeorm_1 = require("typeorm");
class OutboxProcessor {
    constructor() {
        this.claimTimeoutMs = 10 * 60_000;
        this.maxAttempts = 8;
    }
    expirationReason(_item) {
        return null;
    }
    async processPending(limit = 25) {
        const items = await this.claimBatch(limit);
        let processed = 0;
        let failed = 0;
        for (const item of items) {
            const expiration = this.expirationReason(item);
            if (expiration) {
                item.status = 'expired';
                item.nextAttemptAt = null;
                item.lastError = expiration;
                failed += 1;
                await this.repository.save(item);
                continue;
            }
            try {
                await this.send(item);
                item.status = 'processed';
                item.processedAt = new Date();
                item.lastError = null;
                processed += 1;
            }
            catch (error) {
                this.applyFailure(item, error);
                failed += 1;
            }
            await this.repository.save(item);
        }
        return { processed, failed };
    }
    async claimBatch(limit) {
        const now = new Date();
        return this.repository.manager.transaction(async (manager) => {
            const repository = manager.getRepository(this.entity);
            await repository.createQueryBuilder()
                .update()
                .set({ status: 'retry' })
                .where('status = :status AND updated_at <= :staleBefore', {
                status: 'processing',
                staleBefore: new Date(now.getTime() - this.claimTimeoutMs),
            })
                .execute();
            const items = await repository.find({
                where: [
                    { status: (0, typeorm_1.In)(['pending', 'retry']), nextAttemptAt: (0, typeorm_1.IsNull)() },
                    { status: (0, typeorm_1.In)(['pending', 'retry']), nextAttemptAt: (0, typeorm_1.LessThanOrEqual)(now) },
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
    applyFailure(item, error) {
        const verdict = this.classifyFailure(error);
        item.attempts += 1;
        const message = error instanceof Error ? error.message : String(error);
        const partes = [verdict.tag, message, verdict.detail].filter(Boolean);
        item.lastError = partes.join(' ');
        if (!verdict.retryable || item.attempts >= this.maxAttempts) {
            item.status = 'failed';
            item.nextAttemptAt = null;
        }
        else {
            item.status = 'retry';
            item.nextAttemptAt = new Date(Date.now() + Math.min(60, 2 ** item.attempts) * 60_000);
        }
        this.logger.warn(`${this.label} outbox ${item.id} failed${verdict.retryable ? '' : ' (non-retryable)'} (attempt ${item.attempts}): ${item.lastError}`);
    }
    async cleanup(olderThanDays = 7) {
        const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
        const procesados = await this.repository.delete({ status: 'processed', processedAt: (0, typeorm_1.LessThanOrEqual)(cutoff) });
        const terminales = await this.repository.delete({ status: (0, typeorm_1.In)(['failed', 'expired']), createdAt: (0, typeorm_1.LessThanOrEqual)(cutoff) });
        return { deleted: (procesados.affected ?? 0) + (terminales.affected ?? 0) };
    }
}
exports.OutboxProcessor = OutboxProcessor;
