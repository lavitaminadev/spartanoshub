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
var AutomationRunnerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationRunnerService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const automation_entity_1 = require("./automation.entity");
const automation_run_entity_1 = require("./automation-run.entity");
const automation_run_step_entity_1 = require("./automation-run-step.entity");
const automation_catalog_1 = require("./automation-catalog");
const automation_graph_1 = require("./automation-graph");
const automation_actions_service_1 = require("./automation-actions.service");
const CLAIM_TIMEOUT_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_STEPS_PER_PASS = 50;
let AutomationRunnerService = AutomationRunnerService_1 = class AutomationRunnerService {
    constructor(automations, runs, steps, actions) {
        this.automations = automations;
        this.runs = runs;
        this.steps = steps;
        this.actions = actions;
        this.logger = new common_1.Logger(AutomationRunnerService_1.name);
    }
    async processPending(limit = 25) {
        const pendientes = await this.claimBatch(limit);
        let processed = 0;
        let failed = 0;
        for (const run of pendientes) {
            try {
                await this.advance(run);
                processed += 1;
            }
            catch (error) {
                failed += 1;
                await this.recordFailure(run, error);
            }
        }
        return { processed, failed };
    }
    async claimBatch(limit) {
        const ahora = new Date();
        return this.runs.manager.transaction(async (manager) => {
            await this.releaseStaleClaims(manager, new Date(ahora.getTime() - CLAIM_TIMEOUT_MS));
            const repo = manager.getRepository(automation_run_entity_1.AutomationRun);
            const items = await repo.find({
                where: [
                    { status: 'pending' },
                    { status: 'waiting', resumeAt: (0, typeorm_2.LessThanOrEqual)(ahora) },
                    { status: 'waiting', resumeAt: (0, typeorm_2.IsNull)() },
                ],
                order: { createdAt: 'ASC' },
                take: limit,
                lock: { mode: 'pessimistic_write' },
            });
            if (items.length === 0)
                return [];
            await repo.update(items.map((item) => item.id), { status: 'running', startedAt: ahora });
            return items;
        });
    }
    async releaseStaleClaims(manager, staleBefore) {
        await manager.getRepository(automation_run_entity_1.AutomationRun)
            .createQueryBuilder()
            .update()
            .set({ status: 'pending' })
            .where('status = :status AND updated_at <= :staleBefore', { status: 'running', staleBefore })
            .execute();
    }
    async advance(run) {
        const automation = await this.automations.findOne({
            where: { id: run.automationId, organizationId: run.organizationId },
        });
        if (!automation) {
            await this.finish(run, 'cancelled', 'La automatización ya no existe');
            return;
        }
        const graph = automation.graph;
        const contexto = { ...(run.context ?? {}) };
        let actual = this.resumePoint(graph, run);
        let pasos = 0;
        while (actual && pasos < MAX_STEPS_PER_PASS) {
            pasos += 1;
            if (actual.type === 'delay') {
                const espera = (0, automation_catalog_1.delayToMs)(actual.config);
                run.context = contexto;
                run.currentNodeId = actual.id;
                run.status = 'waiting';
                run.resumeAt = new Date(Date.now() + espera);
                await this.runs.save(run);
                return;
            }
            const siguiente = await this.runNode(run, automation, actual, contexto, graph);
            actual = siguiente;
        }
        if (pasos >= MAX_STEPS_PER_PASS) {
            await this.finish(run, 'failed', `La ejecución superó los ${MAX_STEPS_PER_PASS} pasos permitidos`);
            return;
        }
        run.context = contexto;
        await this.finish(run, 'completed');
    }
    resumePoint(graph, run) {
        if (run.currentNodeId)
            return (0, automation_graph_1.nextNode)(graph, run.currentNodeId);
        const disparador = graph.nodes.find((node) => node.type === 'trigger');
        return disparador ? (0, automation_graph_1.nextNode)(graph, disparador.id) : null;
    }
    async runNode(run, automation, node, contexto, graph) {
        const inicio = Date.now();
        if (node.type === 'condition') {
            const cumple = (0, automation_graph_1.evaluateCondition)(node.config, contexto);
            await this.recordStep(run, node, 'completed', { field: node.config.field }, { result: cumple }, inicio);
            return (0, automation_graph_1.nextNode)(graph, node.id, cumple ? 'true' : 'false');
        }
        if (node.type === 'action') {
            try {
                const salida = await this.actions.execute(node.key, node.config, {
                    organizationId: run.organizationId,
                    entityType: run.entityType,
                    entityId: run.entityId,
                    actingUserId: automation.runAsUserId,
                    context: contexto,
                });
                Object.assign(contexto, salida ?? {});
                await this.recordStep(run, node, 'completed', node.config, salida ?? null, inicio);
            }
            catch (error) {
                await this.recordStep(run, node, 'failed', node.config, null, inicio, error);
                throw error;
            }
            return (0, automation_graph_1.nextNode)(graph, node.id);
        }
        await this.recordStep(run, node, 'skipped', null, null, inicio);
        return (0, automation_graph_1.nextNode)(graph, node.id);
    }
    async recordStep(run, node, status, input, output, startedAt, error) {
        try {
            await this.steps.save(this.steps.create({
                runId: run.id,
                nodeId: node.id,
                nodeType: node.type,
                nodeKey: node.key,
                status,
                input: this.trim(input),
                output: this.trim(output),
                error: error instanceof Error ? error.message : error ? String(error) : null,
                durationMs: Date.now() - startedAt,
            }));
        }
        catch (fallo) {
            this.logger.warn(`No se pudo registrar el paso ${node.id} de la ejecución ${run.id}: ${fallo instanceof Error ? fallo.message : fallo}`);
        }
    }
    trim(value) {
        if (!value || typeof value !== 'object')
            return null;
        const texto = JSON.stringify(value);
        if (texto.length <= 2000)
            return value;
        return { truncated: true, preview: texto.slice(0, 2000) };
    }
    async recordFailure(run, error) {
        run.attempts += 1;
        run.lastError = error instanceof Error ? error.message : String(error);
        if (run.attempts >= MAX_ATTEMPTS) {
            await this.finish(run, 'failed', run.lastError);
            return;
        }
        run.status = 'waiting';
        run.resumeAt = new Date(Date.now() + Math.min(60, 2 ** run.attempts) * 60_000);
        await this.runs.save(run);
        this.logger.warn(`Ejecución ${run.id} falló (intento ${run.attempts}): ${run.lastError}`);
    }
    async finish(run, status, error) {
        run.status = status;
        run.finishedAt = new Date();
        run.resumeAt = null;
        if (error)
            run.lastError = error;
        await this.runs.save(run);
    }
    async cleanup(olderThanDays = 30) {
        const corte = new Date(Date.now() - olderThanDays * 86_400_000);
        const terminadas = await this.runs.find({
            where: { status: (0, typeorm_2.In)(['completed', 'failed', 'cancelled']), finishedAt: (0, typeorm_2.LessThanOrEqual)(corte) },
            select: { id: true },
            take: 1000,
        });
        if (!terminadas.length)
            return { deleted: 0 };
        const ids = terminadas.map((run) => run.id);
        await this.steps.delete({ runId: (0, typeorm_2.In)(ids) });
        const resultado = await this.runs.delete({ id: (0, typeorm_2.In)(ids) });
        return { deleted: resultado.affected ?? 0 };
    }
};
exports.AutomationRunnerService = AutomationRunnerService;
exports.AutomationRunnerService = AutomationRunnerService = AutomationRunnerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(automation_entity_1.Automation)),
    __param(1, (0, typeorm_1.InjectRepository)(automation_run_entity_1.AutomationRun)),
    __param(2, (0, typeorm_1.InjectRepository)(automation_run_step_entity_1.AutomationRunStep)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        automation_actions_service_1.AutomationActionsService])
], AutomationRunnerService);
