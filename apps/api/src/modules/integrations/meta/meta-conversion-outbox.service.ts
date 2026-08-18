import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxProcessor, type FailureVerdict } from '../../../core/outbox/outbox-processor.base';
import { ConversionEvent, MetaConversionsService } from './meta-conversions.service';
import { MetaConversionOutbox } from './meta-conversion-outbox.entity';
import { MetaClientPixelService } from './meta-client-pixel.service';

/**
 * Ventana que Meta acepta para recibir una conversión pasada, según el origen del evento.
 *
 * Los eventos de tienda física admiten 62 días porque describen algo que ocurrió en el
 * local y suelen cargarse con retraso: la asistencia se marca cuando alguien la registra, no
 * cuando el comensal llega. Aplicarles el corte de 7 días descartaba localmente conversiones
 * que Meta sí habría aceptado, incluida toda importación de histórico.
 */
const MAX_AGE_DAYS_BY_ACTION_SOURCE: Record<string, number> = {
  physical_store: 62,
};

/** Ventana por defecto, para eventos originados en la web. */
const DEFAULT_MAX_AGE_DAYS = 7;

/**
 * Código con el que Meta señala que el token dejó de servir.
 *
 * `190` es el de OAuth: cubre token vencido, revocado y sesión invalidada por cambio de
 * contraseña. Se prefiere al texto del mensaje porque el texto cambia con el idioma y con la
 * versión de la API.
 */
const META_OAUTH_ERROR_CODE = 190;

interface ApiError {
  response?: {
    status: number;
    data?: { error?: { message?: string; error_user_msg?: string; code?: number; type?: string } };
  };
  message?: string;
}

/**
 * Bandeja de salida de las conversiones que se envían a Meta.
 *
 * La mecánica —reservar un lote con bloqueo, enviar fuera de la transacción, devolver a la cola
 * lo abandonado, reintentar con espera creciente y limpiar los estados terminales— vive en
 * `OutboxProcessor`, compartida con Google y con los webhooks. Acá queda solo lo propio de
 * Meta: su ventana de atribución, cómo envía y qué respuestas no vale la pena repetir.
 */
@Injectable()
export class MetaConversionOutboxService extends OutboxProcessor<MetaConversionOutbox> {
  protected readonly logger = new Logger(MetaConversionOutboxService.name);
  protected readonly entity = MetaConversionOutbox;
  protected readonly label = 'Meta CAPI';

  constructor(
    @InjectRepository(MetaConversionOutbox) protected readonly repository: Repository<MetaConversionOutbox>,
    private readonly conversions: MetaConversionsService,
    private readonly clientPixels: MetaClientPixelService,
  ) {
    super();
  }

  /**
   * Encola un evento, o devuelve el que ya estaba.
   *
   * El `eventId` es la clave de deduplicación que Meta usa para no contar dos veces la misma
   * conversión, así que sin él no se puede encolar nada.
   */
  async enqueue(organizationId: string, pixelId: string, event: ConversionEvent): Promise<MetaConversionOutbox> {
    const eventId = event.eventId;
    if (!eventId) throw new Error('A stable eventId is required for Meta CAPI');
    const existing = await this.repository.findOne({ where: { organizationId, eventId } });
    if (existing) return existing;
    return this.repository.save(this.repository.create({ organizationId, pixelId, eventId, eventData: event }));
  }

  /**
   * @param organizationId - Acota el conteo. El diagnóstico por cron lo omite a propósito para
   *   ver la cola completa; cualquier consulta desde la aplicación debe pasarlo.
   */
  async stats(organizationId?: string): Promise<{ pending: number; retry: number; processing: number; failed: number; expired: number; processed: number; total: number }> {
    const scope = organizationId ? { organizationId } : {};
    const countBy = (status?: string) => this.repository.count({ where: status ? { ...scope, status } : scope });
    const [pending, retry, processing, failed, expired, processed, total] = await Promise.all([
      countBy('pending'),
      countBy('retry'),
      // 'processing' son eventos ya tomados por una ejecución en curso. Si este número no
      // baja entre diagnósticos, hay lotes quedándose atascados.
      countBy('processing'),
      countBy('failed'),
      // Se cuenta aparte porque es una conversión perdida de forma definitiva. Omitirlo hacía
      // que la suma de estados no cuadrara con el total y que una pérdida por antigüedad no
      // apareciera en ningún número.
      countBy('expired'),
      countBy('processed'),
      countBy(),
    ]);
    return { pending, retry, processing, failed, expired, processed, total };
  }

  /** Eventos que no lograron enviarse, con su motivo, para diagnosticar desde la aplicación. */
  async recentProblems(organizationId: string, limit = 20): Promise<MetaConversionOutbox[]> {
    return this.repository.find({
      where: [
        { organizationId, status: 'failed' },
        { organizationId, status: 'expired' },
        { organizationId, status: 'retry' },
      ],
      order: { updatedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  /**
   * Ventana de atribución de Meta, según el origen del evento.
   *
   * Pasada esa ventana el evento ya no puede atribuirse. Sin este corte agotaba los ocho
   * reintentos contra una ventana cerrada y terminaba como un fallo genérico.
   */
  protected expirationReason(item: MetaConversionOutbox): string | null {
    const event = item.eventData as ConversionEvent;
    const eventTime = Number(event?.eventTime ?? 0);
    if (eventTime <= 0) return null;

    const maxAgeDays = MAX_AGE_DAYS_BY_ACTION_SOURCE[event?.actionSource ?? ''] ?? DEFAULT_MAX_AGE_DAYS;
    if (Date.now() - eventTime * 1000 <= maxAgeDays * 86_400_000) return null;

    return `El evento supera los ${maxAgeDays} días que acepta Meta para su origen y ya no puede atribuirse.`;
  }

  protected async send(item: MetaConversionOutbox): Promise<void> {
    const token = await this.clientPixels.resolveByPixel(item.organizationId, item.pixelId);
    if (!token) throw new Error('Meta conversion token is unavailable');
    await this.conversions.sendServerEvent(item.pixelId, token, item.eventData as ConversionEvent);
  }

  /**
   * Un token revocado no se reintenta: hasta que alguien lo renueve, los ocho intentos darían
   * el mismo error y el aviso quedaría enterrado entre fallos genéricos.
   *
   * Se mira primero el código, que Meta mantiene estable. El texto queda como respaldo para
   * respuestas que no lo traigan: la revocación más común —«the session has been invalidated
   * because the user changed their password»— no la reconocía ninguna variante del texto, así
   * que caía a fallo genérico y el aviso nunca aparecía.
   */
  protected classifyFailure(error: unknown): FailureVerdict {
    const apiError = error as ApiError;
    const statusCode = apiError?.response?.status;
    const metaError = apiError?.response?.data?.error;
    const bodyMsg: string = metaError?.message ?? metaError?.error_user_msg ?? '';

    const isNonRetryable = typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500 && statusCode !== 429;
    const isExpiredToken = metaError?.code === META_OAUTH_ERROR_CODE
      || metaError?.type === 'OAuthException'
      || /expired|invalid.*token|invalidated|revoked|unauthorized/i.test(bodyMsg);

    // El orden importa: `[TOKEN]` va primero para poder filtrar por él en los registros, y el
    // código HTTP después, que es como venía el mensaje antes de compartir el procesador.
    const prefijos = [
      isExpiredToken ? '[TOKEN]' : null,
      statusCode ? `HTTP ${statusCode}:` : null,
    ].filter(Boolean);

    return {
      retryable: !isNonRetryable && !isExpiredToken,
      tag: prefijos.length ? prefijos.join(' ') : undefined,
    };
  }
}
