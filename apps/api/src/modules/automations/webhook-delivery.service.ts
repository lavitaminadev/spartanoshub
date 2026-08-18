import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { WebhookDelivery } from './webhook-delivery.entity';

/** Intentos antes de darlo por perdido. Mismo criterio que la bandeja de conversiones. */
const MAX_ATTEMPTS = 6;

/** Tiempo de espera de la llamada. Un tercero lento no puede retener el trabajo indefinidamente. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Entrega de webhooks salientes.
 *
 * Reproduce el patrón de la bandeja de salida de conversiones: encolar, tomar un lote,
 * reintentar con espera creciente y no reintentar lo que no tiene arreglo. Un 4xx es el
 * destinatario diciendo que el mensaje está mal —reintentarlo daría el mismo resultado seis
 * veces—, mientras que un 5xx o una caída de red sí merecen otra oportunidad.
 */
@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    @InjectRepository(WebhookDelivery) private readonly deliveries: Repository<WebhookDelivery>,
    private readonly http: HttpService,
  ) {}

  /**
   * Deja el envío en la bandeja.
   *
   * @throws BadRequestException si la dirección no es válida o no usa HTTPS.
   */
  async enqueue(organizationId: string, url: string, payload: Record<string, unknown>, runId?: string): Promise<WebhookDelivery> {
    this.assertSafeUrl(url);
    return this.deliveries.save(this.deliveries.create({
      organizationId, url, payload, runId: runId ?? null, status: 'pending',
    }));
  }

  /**
   * Comprueba la dirección antes de guardarla.
   *
   * Se exige HTTPS y se rechazan las direcciones internas. Un webhook es una dirección que
   * escribe una persona desde una pantalla, y sin esta comprobación el servidor podría ser
   * usado para alcanzar servicios de la propia red que no están expuestos a internet.
   */
  private assertSafeUrl(rawUrl: string): void {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException('La dirección del webhook no es válida');
    }

    if (url.protocol !== 'https:') {
      throw new BadRequestException('El webhook debe usar HTTPS');
    }

    const host = url.hostname.toLowerCase();
    const esInterno = host === 'localhost'
      || host === '::1'
      || /^127\./.test(host)
      || /^10\./.test(host)
      || /^192\.168\./.test(host)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
      // Metadatos de instancia en varios proveedores de nube: nunca debe alcanzarse desde acá.
      || host === '169.254.169.254';

    if (esInterno) {
      throw new BadRequestException('El webhook no puede apuntar a una dirección interna');
    }
  }

  /** Envía lo pendiente. Lo llama el planificador. */
  async processPending(limit = 20): Promise<{ sent: number; failed: number }> {
    const lote = await this.claimBatch(limit);
    let sent = 0;
    let failed = 0;

    for (const item of lote) {
      try {
        const response = await firstValueFrom(
          this.http.post(item.url, item.payload, {
            timeout: REQUEST_TIMEOUT_MS,
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'Espartanos-Automations/1' },
          }),
        );
        item.status = 'sent';
        item.sentAt = new Date();
        item.lastStatusCode = response.status;
        item.lastError = null;
        sent += 1;
      } catch (error) {
        this.recordFailure(item, error);
        failed += 1;
      }
      await this.deliveries.save(item);
    }

    return { sent, failed };
  }

  /** Reserva un lote en una transacción corta; la llamada de red ocurre fuera. */
  private async claimBatch(limit: number): Promise<WebhookDelivery[]> {
    const ahora = new Date();
    return this.deliveries.manager.transaction(async (manager) => {
      const repo = manager.getRepository(WebhookDelivery);
      const items = await repo.find({
        where: [
          { status: 'pending', nextAttemptAt: IsNull() },
          { status: 'pending', nextAttemptAt: LessThanOrEqual(ahora) },
        ],
        order: { createdAt: 'ASC' },
        take: limit,
        lock: { mode: 'pessimistic_write' },
      });
      if (!items.length) return [];
      await repo.update(items.map((item) => item.id), { status: 'processing' });
      return items;
    });
  }

  private recordFailure(item: WebhookDelivery, error: unknown): void {
    const response = (error as { response?: { status?: number } })?.response;
    const statusCode = response?.status;

    item.attempts += 1;
    item.lastStatusCode = statusCode ?? null;
    item.lastError = error instanceof Error ? error.message : String(error);

    // Un 4xx que no sea 429 es el destinatario diciendo que el mensaje está mal: repetirlo
    // daría el mismo resultado seis veces y retrasaría los envíos que sí pueden salir.
    const noReintentable = typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500 && statusCode !== 429;

    if (noReintentable || item.attempts >= MAX_ATTEMPTS) {
      item.status = 'failed';
      item.nextAttemptAt = null;
    } else {
      item.status = 'pending';
      item.nextAttemptAt = new Date(Date.now() + Math.min(60, 2 ** item.attempts) * 60_000);
    }

    this.logger.warn(`Webhook ${item.id} falló (intento ${item.attempts}): ${item.lastError}`);
  }

  /** Borra lo terminal antiguo para que la tabla no crezca sin techo. */
  async cleanup(olderThanDays = 14): Promise<{ deleted: number }> {
    const corte = new Date(Date.now() - olderThanDays * 86_400_000);
    const resultado = await this.deliveries.delete({
      status: In(['sent', 'failed']),
      updatedAt: LessThanOrEqual(corte),
    });
    return { deleted: resultado.affected ?? 0 };
  }
}
