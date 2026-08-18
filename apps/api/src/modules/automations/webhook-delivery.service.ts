import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { OutboxProcessor, type FailureVerdict } from '../../core/outbox/outbox-processor.base';
import { WebhookDelivery } from './webhook-delivery.entity';

/** Tiempo de espera de la llamada. Un tercero lento no puede retener el trabajo. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Direcciones que el servidor no debe alcanzar aunque alguien las escriba.
 *
 * Un webhook lo configura una persona desde una pantalla. Sin este filtro, el servidor podría
 * usarse para llegar a servicios de la propia red que no están expuestos a internet, incluido
 * el punto de metadatos de la nube, que entrega credenciales de la instancia.
 */
const INTERNAL_HOST_PATTERNS = [
  /^localhost$/,
  /^::1$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\.169\.254$/,
];

/**
 * Entrega de los webhooks que envían las automatizaciones.
 *
 * Toda la mecánica de reserva, reintento y limpieza vive en `OutboxProcessor`. Acá queda solo
 * lo propio: qué direcciones se aceptan, cómo se hace la llamada y qué respuesta no vale la
 * pena repetir.
 */
@Injectable()
export class WebhookDeliveryService extends OutboxProcessor<WebhookDelivery> {
  protected readonly logger = new Logger(WebhookDeliveryService.name);
  protected readonly entity = WebhookDelivery;
  protected readonly label = 'Webhook';

  /** Seis en vez de ocho: un destinatario propio que falla seis veces no va a responder. */
  protected readonly maxAttempts = 6;

  constructor(
    @InjectRepository(WebhookDelivery) protected readonly repository: Repository<WebhookDelivery>,
    private readonly http: HttpService,
  ) {
    super();
  }

  /**
   * Deja el envío en la bandeja.
   *
   * @throws BadRequestException si la dirección no es válida, no usa HTTPS o apunta adentro.
   */
  async enqueue(organizationId: string, url: string, payload: Record<string, unknown>, runId?: string): Promise<WebhookDelivery> {
    this.assertSafeUrl(url);
    return this.repository.save(this.repository.create({
      organizationId, url, payload, runId: runId ?? null, status: 'pending',
    }));
  }

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
    if (INTERNAL_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
      throw new BadRequestException('El webhook no puede apuntar a una dirección interna');
    }
  }

  protected async send(item: WebhookDelivery): Promise<void> {
    const response = await firstValueFrom(
      this.http.post(item.url, item.payload, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Espartanos-Automations/1' },
      }),
    );
    item.lastStatusCode = response.status;
  }

  /**
   * Un 4xx que no sea 429 es el destinatario diciendo que el mensaje está mal: repetirlo daría
   * el mismo resultado seis veces y retrasaría los envíos que sí pueden salir.
   */
  protected classifyFailure(error: unknown): FailureVerdict {
    const status = (error as { response?: { status?: number } })?.response?.status;
    const definitivo = typeof status === 'number' && status >= 400 && status < 500 && status !== 429;
    return { retryable: !definitivo, tag: status ? `HTTP ${status}:` : undefined };
  }
}
