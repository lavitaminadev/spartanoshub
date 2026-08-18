import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { Automation, type AutomationGraph, type AutomationNode } from './automation.entity';
import { AutomationRun } from './automation-run.entity';
import { AutomationRunStep } from './automation-run-step.entity';
import { delayToMs, type ConditionConfig, type DelayConfig } from './automation-catalog';
import { evaluateCondition, nextNode } from './automation-graph';
import { AutomationActionsService } from './automation-actions.service';

/** Tiempo tras el cual una ejecución tomada se considera abandonada y vuelve a la cola. */
const CLAIM_TIMEOUT_MS = 10 * 60_000;

/** Intentos antes de darla por fallida. Igual criterio que la bandeja de salida de Meta. */
const MAX_ATTEMPTS = 5;

/**
 * Tope de pasos por tanda de ejecución.
 *
 * El validador ya impide los ciclos, así que un grafo guardado no puede ser infinito. Esto es
 * la segunda barrera, para un grafo escrito antes de esa validación o para un error del
 * ejecutor: sin ella un fallo de recorrido bloquearía el proceso entero, y con 768 MB
 * compartidos eso alcanza a todo lo demás.
 */
const MAX_STEPS_PER_PASS = 50;

/**
 * Ejecuta las automatizaciones pendientes.
 *
 * Reproduce el patrón que ya funciona en la bandeja de salida de conversiones, porque el
 * problema es el mismo: trabajo diferido que no puede perderse, que no debe ejecutarse dos
 * veces y que a veces falla por causas pasajeras. Reservar con bloqueo en una transacción
 * corta, trabajar fuera de ella, reintentar con espera creciente y no reintentar lo que no
 * tiene arreglo.
 *
 * No hace falta ni Redis ni un proceso aparte: la reserva es una consulta y la espera es una
 * fecha en una fila.
 */
@Injectable()
export class AutomationRunnerService {
  private readonly logger = new Logger(AutomationRunnerService.name);

  constructor(
    @InjectRepository(Automation) private readonly automations: Repository<Automation>,
    @InjectRepository(AutomationRun) private readonly runs: Repository<AutomationRun>,
    @InjectRepository(AutomationRunStep) private readonly steps: Repository<AutomationRunStep>,
    private readonly actions: AutomationActionsService,
  ) {}

  /**
   * Procesa las ejecuciones listas: las nuevas y las que terminaron su espera.
   *
   * @param limit - Máximo de ejecuciones a tomar en esta tanda.
   */
  async processPending(limit = 25): Promise<{ processed: number; failed: number }> {
    const pendientes = await this.claimBatch(limit);
    let processed = 0;
    let failed = 0;

    for (const run of pendientes) {
      try {
        await this.advance(run);
        processed += 1;
      } catch (error) {
        failed += 1;
        await this.recordFailure(run, error);
      }
    }

    return { processed, failed };
  }

  /**
   * Reserva un lote de ejecuciones marcándolas como en curso.
   *
   * La transacción es corta y solo reserva: el trabajo real ocurre fuera, porque un nodo
   * puede tardar y mantener filas bloqueadas mientras tanto detendría a los demás.
   */
  private async claimBatch(limit: number): Promise<AutomationRun[]> {
    const ahora = new Date();
    return this.runs.manager.transaction(async (manager) => {
      await this.releaseStaleClaims(manager, new Date(ahora.getTime() - CLAIM_TIMEOUT_MS));

      const repo = manager.getRepository(AutomationRun);
      const items = await repo.find({
        where: [
          { status: 'pending' },
          { status: 'waiting', resumeAt: LessThanOrEqual(ahora) },
          { status: 'waiting', resumeAt: IsNull() },
        ],
        order: { createdAt: 'ASC' },
        take: limit,
        lock: { mode: 'pessimistic_write' },
      });
      if (items.length === 0) return [];

      await repo.update(items.map((item) => item.id), { status: 'running', startedAt: ahora });
      return items;
    });
  }

  /** Devuelve a la cola lo que quedó en curso por una ejecución que no llegó a terminar. */
  private async releaseStaleClaims(manager: EntityManager, staleBefore: Date): Promise<void> {
    await manager.getRepository(AutomationRun)
      .createQueryBuilder()
      .update()
      .set({ status: 'pending' })
      .where('status = :status AND updated_at <= :staleBefore', { status: 'running', staleBefore })
      .execute();
  }

  /**
   * Avanza una ejecución hasta que termine, se detenga en una espera o falle.
   *
   * Recorre el grafo de la versión con la que empezó, no la vigente: un grafo editado a mitad
   * de una espera de dos días no debe cambiar el recorrido de lo que ya iba en camino.
   */
  private async advance(run: AutomationRun): Promise<void> {
    const automation = await this.automations.findOne({
      where: { id: run.automationId, organizationId: run.organizationId },
    });
    if (!automation) {
      await this.finish(run, 'cancelled', 'La automatización ya no existe');
      return;
    }

    const graph = automation.graph as AutomationGraph;
    const contexto = { ...(run.context ?? {}) } as Record<string, unknown>;
    let actual = this.resumePoint(graph, run);
    let pasos = 0;

    while (actual && pasos < MAX_STEPS_PER_PASS) {
      pasos += 1;

      if (actual.type === 'delay') {
        // La espera no ocupa nada: se anota cuándo continuar y la ejecución se suelta.
        const espera = delayToMs(actual.config as unknown as DelayConfig);
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

  /**
   * Nodo por el que retomar.
   *
   * Al empezar es el que sigue al disparador. Tras una espera es el que sigue al nodo donde
   * se detuvo: continuar por el mismo repetiría la espera para siempre.
   */
  private resumePoint(graph: AutomationGraph, run: AutomationRun): AutomationNode | null {
    if (run.currentNodeId) return nextNode(graph, run.currentNodeId);
    const disparador = graph.nodes.find((node) => node.type === 'trigger');
    return disparador ? nextNode(graph, disparador.id) : null;
  }

  /** Ejecuta un nodo, deja constancia y devuelve el siguiente. */
  private async runNode(
    run: AutomationRun,
    automation: Automation,
    node: AutomationNode,
    contexto: Record<string, unknown>,
    graph: AutomationGraph,
  ): Promise<AutomationNode | null> {
    const inicio = Date.now();

    if (node.type === 'condition') {
      const cumple = evaluateCondition(node.config as unknown as ConditionConfig, contexto);
      await this.recordStep(run, node, 'completed', { field: (node.config as { field?: string }).field }, { result: cumple }, inicio);
      return nextNode(graph, node.id, cumple ? 'true' : 'false');
    }

    if (node.type === 'action') {
      try {
        const salida = await this.actions.execute(node.key, node.config, {
          organizationId: run.organizationId,
          entityType: run.entityType,
          entityId: run.entityId,
          // Toda escritura queda atribuida a la identidad declarada en la automatización.
          // Sin esto, un efecto quedaría en la bitácora sin responsable.
          actingUserId: automation.runAsUserId,
          context: contexto,
        });
        Object.assign(contexto, salida ?? {});
        await this.recordStep(run, node, 'completed', node.config, salida ?? null, inicio);
      } catch (error) {
        await this.recordStep(run, node, 'failed', node.config, null, inicio, error);
        throw error;
      }
      return nextNode(graph, node.id);
    }

    await this.recordStep(run, node, 'skipped', null, null, inicio);
    return nextNode(graph, node.id);
  }

  /**
   * Guarda el paso ejecutado.
   *
   * Nunca interrumpe la ejecución: perder una fila de diagnóstico es molesto, detener una
   * automatización a mitad porque no se pudo escribir el registro es peor.
   */
  private async recordStep(
    run: AutomationRun,
    node: AutomationNode,
    status: 'completed' | 'failed' | 'skipped',
    input: unknown,
    output: unknown,
    startedAt: number,
    error?: unknown,
  ): Promise<void> {
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
    } catch (fallo) {
      this.logger.warn(`No se pudo registrar el paso ${node.id} de la ejecución ${run.id}: ${fallo instanceof Error ? fallo.message : fallo}`);
    }
  }

  /**
   * Recorta lo que se guarda como entrada o salida.
   *
   * El contexto de una ejecución larga puede crecer, y acá hay una fila por paso: sin tope, la
   * tabla de diagnóstico terminaría pesando más que los datos del negocio.
   */
  private trim(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') return null;
    const texto = JSON.stringify(value);
    if (texto.length <= 2000) return value as Record<string, unknown>;
    return { truncated: true, preview: texto.slice(0, 2000) };
  }

  /** Marca el fallo y decide si vuelve a intentarse. */
  private async recordFailure(run: AutomationRun, error: unknown): Promise<void> {
    run.attempts += 1;
    run.lastError = error instanceof Error ? error.message : String(error);

    if (run.attempts >= MAX_ATTEMPTS) {
      await this.finish(run, 'failed', run.lastError);
      return;
    }

    // Espera creciente con techo, igual que la bandeja de conversiones: reintentar de
    // inmediato contra una causa que no se ha resuelto solo gasta intentos.
    run.status = 'waiting';
    run.resumeAt = new Date(Date.now() + Math.min(60, 2 ** run.attempts) * 60_000);
    await this.runs.save(run);
    this.logger.warn(`Ejecución ${run.id} falló (intento ${run.attempts}): ${run.lastError}`);
  }

  private async finish(run: AutomationRun, status: AutomationRun['status'], error?: string): Promise<void> {
    run.status = status;
    run.finishedAt = new Date();
    run.resumeAt = null;
    if (error) run.lastError = error;
    await this.runs.save(run);
  }

  /** Borra ejecuciones terminadas y sus pasos, para que las tablas no crezcan sin techo. */
  async cleanup(olderThanDays = 30): Promise<{ deleted: number }> {
    const corte = new Date(Date.now() - olderThanDays * 86_400_000);
    const terminadas = await this.runs.find({
      where: { status: In(['completed', 'failed', 'cancelled']), finishedAt: LessThanOrEqual(corte) },
      select: { id: true },
      take: 1000,
    });
    if (!terminadas.length) return { deleted: 0 };

    const ids = terminadas.map((run) => run.id);
    await this.steps.delete({ runId: In(ids) });
    const resultado = await this.runs.delete({ id: In(ids) });
    return { deleted: resultado.affected ?? 0 };
  }
}
