import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { prepararIdentificadores } from './identificadores-meta';
import { construirEventoPermitido, registrarBloqueo, revisarEvento } from './politica-meta-capi';
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
    data?: { error?: {
      message?: string; error_user_msg?: string; code?: number; type?: string;
      /* Identifica el problema exacto dentro de un mismo `code`: 100/2804036 es lead_id invalido. */
      error_subcode?: number;
      /* Lo que pide el soporte de Meta para rastrear una peticion concreta. */
      fbtrace_id?: string;
    } };
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
    /*
     * Los identificadores se hashean antes de guardar, no antes de enviar.
     *
     * Funcionaba igual haciéndolo al enviar —Meta nunca recibió nada en claro—, pero dejaba
     * correo y teléfono legibles en la cola durante todo el tiempo que el evento espera, y
     * después indefinidamente en las filas ya procesadas. Es una copia de datos personales que
     * nadie necesita: para enviarlos hace falta el digest, no el original.
     *
     * Va acá y no en cada emisor porque por esta puerta pasan los dos —etapas del CRM y
     * reservas—, y porque `prepararIdentificadores` reconoce lo ya hasheado: quien mande el
     * digest hecho no lo estropea, y el envío lo vuelve a comprobar de todas formas.
     */
    /*
     * Control 1: lo que no está en la lista blanca no entra a la cola.
     *
     * Se revisa antes de descartar, para poder decir qué campo sobraba: si se sanea en silencio,
     * quien añadió el campo cree que está viajando a Meta y construye encima de algo que nunca
     * llegó. Con el bloqueo registrado el fallo es visible; sin él, invisible durante meses.
     */
    const infracciones = revisarEvento(event as unknown as Record<string, unknown>);
    if (infracciones.length > 0) {
      registrarBloqueo(eventId, infracciones);
      throw new BadRequestException(
        `Meta CAPI: el evento incluye campos no autorizados (${infracciones.map((i) => `${i.seccion}.${i.campo}`).join(', ')})`,
      );
    }

    const permitido = construirEventoPermitido(event as unknown as Record<string, unknown>);
    const evento = { ...permitido, userData: prepararIdentificadores(permitido.userData as Record<string, unknown>) };
    return this.repository.save(this.repository.create({ organizationId, pixelId, eventId, eventData: evento }));
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
    const respuesta = await this.conversions.sendServerEvent(item.pixelId, token, item.eventData as ConversionEvent);

    /*
     * Que la llamada no falle no significa que Meta lo haya recibido.
     *
     * Axios lanza en cualquier respuesta que no sea 2xx, así que un rechazo se detecta. Pero Meta
     * responde 200 con `events_received: 0` cuando descarta el evento sin considerarlo un error
     * de la petición, y eso quedaba marcado como procesado: una conversión perdida contada como
     * enviada, que es peor que un fallo porque nadie la va a buscar.
     *
     * Si el campo no viene no se bloquea: negarse por un campo ausente convertiría un cambio de
     * la API de Meta en una cola detenida.
     */
    const recibidos = (respuesta as { events_received?: number } | undefined)?.events_received;
    if (typeof recibidos === 'number' && recibidos < 1) {
      throw new Error(`Meta respondió sin recibir el evento (events_received: ${recibidos})`);
    }
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
      // `OAuthException` NO entra acá: Meta lo devuelve también para el código 100 «parámetro
      // inválido» —un lead_id que no existe, un nombre de evento que no acepta—, y marcarlo como
      // token dejaba esos eventos sin reintento esperando una credencial que estaba bien.
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
      /*
       * El motivo tal como lo da Meta.
       *
       * `code` y `error_subcode` identifican el problema sin ambigüedad —100/2804036 es un
       * lead_id que no existe, 190 es credencial—, `error_user_msg` lo dice en palabras, y el
       * `fbtrace_id` es lo que pide el soporte de Meta si hay que escalarlo. Nada de esto lleva
       * el token: el error que llega acá ya viene saneado desde `sendServerEvent`.
       */
      detail: metaError
        ? [
          `meta code=${metaError.code ?? '?'}`,
          metaError.error_subcode ? `subcode=${metaError.error_subcode}` : null,
          metaError.type ? `type=${metaError.type}` : null,
          bodyMsg ? `msg="${bodyMsg}"` : null,
          metaError.fbtrace_id ? `fbtrace=${metaError.fbtrace_id}` : null,
        ].filter(Boolean).join(' ')
        : undefined,
    };
  }
}
