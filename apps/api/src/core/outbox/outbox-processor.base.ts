import { Logger } from '@nestjs/common';
import { EntityTarget, In, IsNull, LessThanOrEqual, ObjectLiteral, Repository } from 'typeorm';

/**
 * Estados por los que pasa un envío. Los comparten las tres bandejas.
 *
 * `retry` y `pending` son ambos «listo para tomar»: se distinguen para poder ver de un vistazo
 * qué nunca se intentó y qué ya falló al menos una vez.
 */
export type OutboxStatus = 'pending' | 'retry' | 'processing' | 'processed' | 'failed' | 'expired';

/** Forma mínima que debe tener una fila para poder pasar por este procesador. */
export interface OutboxRow extends ObjectLiteral {
  id: string;
  status: string;
  attempts: number;
  nextAttemptAt?: Date | null;
  lastError?: string | null;
  processedAt?: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

/** Qué hacer con un envío que falló. */
export interface FailureVerdict {
  /** Falso cuando repetirlo daría el mismo resultado: se marca fallido sin gastar intentos. */
  retryable: boolean;
  /** Prefijo opcional para el mensaje, como `[TOKEN]`, que ayuda a filtrar en diagnóstico. */
  tag?: string;
}

/**
 * Bandeja de salida: trabajo diferido que no puede perderse ni ejecutarse dos veces.
 *
 * Meta, Google y los webhooks de las automatizaciones resolvían lo mismo tres veces, con las
 * mismas cuatro decisiones difíciles copiadas en cada uno: reservar un lote con bloqueo dentro
 * de una transacción corta, hacer la llamada de red **fuera** de ella, devolver a la cola lo
 * que quedó tomado por una ejecución que no terminó, y reintentar con espera creciente sin
 * insistir contra un error que no tiene arreglo.
 *
 * Cuando esas cuatro viven copiadas, corregir una deja las otras dos con el fallo. Acá viven
 * una vez y cada bandeja declara solo lo suyo: cómo envía, cómo clasifica un error y cuándo
 * considera que un envío ya no vale la pena.
 *
 * @typeParam T - Fila concreta de la bandeja.
 */
export abstract class OutboxProcessor<T extends OutboxRow> {
  protected abstract readonly logger: Logger;

  /** Repositorio de la bandeja concreta. */
  protected abstract readonly repository: Repository<T>;

  /** Entidad, necesaria para pedir el repositorio dentro de la transacción. */
  protected abstract readonly entity: EntityTarget<T>;

  /** Nombre para los mensajes de registro, como «Meta CAPI» o «Google Ads». */
  protected abstract readonly label: string;

  /**
   * Tiempo tras el cual un envío tomado se considera abandonado y vuelve a la cola.
   *
   * Cubre el caso de un proceso que muere a mitad del envío: sin esto, esas filas quedarían en
   * `processing` para siempre y nadie volvería a intentarlas.
   */
  protected readonly claimTimeoutMs = 10 * 60_000;

  /** Intentos antes de darlo por perdido. Cada bandeja puede bajarlo. */
  protected readonly maxAttempts: number = 8;

  /** Envía un elemento. Lanzar significa que falló. */
  protected abstract send(item: T): Promise<void>;

  /**
   * Decide si vale la pena reintentar.
   *
   * Cada bandeja reconoce sus propios fallos definitivos: Meta mira el código `190` de OAuth,
   * Google mira `PERMISSION_DENIED`, los webhooks miran el código HTTP. Lo que comparten es qué
   * hacer con el veredicto, no cómo llegar a él.
   */
  protected abstract classifyFailure(error: unknown): FailureVerdict;

  /**
   * Motivo por el que el envío ya no puede hacerse, si lo hay.
   *
   * Devolver un texto lo marca como `expired` sin gastar intentos ni llamar al tercero. Meta lo
   * usa para la ventana de atribución; una bandeja que no caduca no necesita implementarlo.
   */
  protected expirationReason(_item: T): string | null {
    return null;
  }

  /**
   * Procesa lo que esté listo.
   *
   * @param limit - Máximo de elementos a tomar en esta pasada.
   */
  async processPending(limit = 25): Promise<{ processed: number; failed: number }> {
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
      } catch (error) {
        this.applyFailure(item, error);
        failed += 1;
      }
      await this.repository.save(item);
    }

    return { processed, failed };
  }

  /**
   * Reserva un lote marcándolo como en proceso.
   *
   * La transacción es corta y solo reserva. El envío ocurre fuera porque el bloqueo pesimista
   * exige una transacción abierta, y mantener filas bloqueadas durante llamadas de red detiene
   * a todo lo demás que quiera tomar de la misma bandeja.
   */
  private async claimBatch(limit: number): Promise<T[]> {
    const now = new Date();
    return this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository<T>(this.entity);

      await repository.createQueryBuilder()
        .update()
        .set({ status: 'retry' } as never)
        .where('status = :status AND updated_at <= :staleBefore', {
          status: 'processing',
          staleBefore: new Date(now.getTime() - this.claimTimeoutMs),
        })
        .execute();

      const items = await repository.find({
        where: [
          { status: In(['pending', 'retry']), nextAttemptAt: IsNull() },
          { status: In(['pending', 'retry']), nextAttemptAt: LessThanOrEqual(now) },
        ] as never,
        order: { createdAt: 'ASC' } as never,
        take: limit,
        lock: { mode: 'pessimistic_write' },
      });
      if (items.length === 0) return [];

      await repository.update(items.map((item) => item.id), { status: 'processing' } as never);
      return items;
    });
  }

  /**
   * Anota el fallo y decide si vuelve a intentarse.
   *
   * La espera crece exponencialmente con techo de una hora: reintentar de inmediato contra una
   * causa que no se ha resuelto solo gasta los intentos disponibles.
   */
  private applyFailure(item: T, error: unknown): void {
    const verdict = this.classifyFailure(error);
    item.attempts += 1;

    const message = error instanceof Error ? error.message : String(error);
    item.lastError = verdict.tag ? `${verdict.tag} ${message}` : message;

    if (!verdict.retryable || item.attempts >= this.maxAttempts) {
      item.status = 'failed';
      item.nextAttemptAt = null;
    } else {
      item.status = 'retry';
      item.nextAttemptAt = new Date(Date.now() + Math.min(60, 2 ** item.attempts) * 60_000);
    }

    this.logger.warn(
      `${this.label} outbox ${item.id} failed${verdict.retryable ? '' : ' (non-retryable)'} (attempt ${item.attempts}): ${item.lastError}`,
    );
  }

  /**
   * Borra lo que ya no volverá a intentarse.
   *
   * Incluye `expired`: es un estado terminal y, sin limpiarlo, era el único que hacía crecer la
   * tabla sin techo.
   */
  async cleanup(olderThanDays = 7): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
    const procesados = await this.repository.delete({ status: 'processed', processedAt: LessThanOrEqual(cutoff) } as never);
    const terminales = await this.repository.delete({ status: In(['failed', 'expired']), createdAt: LessThanOrEqual(cutoff) } as never);
    return { deleted: (procesados.affected ?? 0) + (terminales.affected ?? 0) };
  }
}
