import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'node:crypto';
import { BadGatewayException } from '@nestjs/common';
import { normalizeGeoValue } from '../../../shared/geo-inference';
import { normalizePhoneDigits } from '../../../shared/phone';

export interface ConversionEvent {
  eventName: string;
  eventTime: number;
  eventSourceUrl?: string;
  actionSource?: string;
  userData: {
    em?: string[];
    ph?: string[];
    fn?: string[];
    ln?: string[];
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string;
    fbp?: string;
    externalId?: string[];
    /** Ciudad normalizada (minúsculas, sin acentos ni espacios). */
    ct?: string[];
    /** Región/estado normalizado. */
    st?: string[];
    /** ISO 3166-1 alpha-2 en minúsculas, ej. 'cl'. */
    country?: string[];
  };
  customData?: {
    currency?: string;
    value?: number;
    contentIds?: string[];
    contentType?: string;
  };
  eventId?: string;
}

@Injectable()
export class MetaConversionsService {
  private readonly logger = new Logger(MetaConversionsService.name);
  constructor(private readonly http: HttpService) {}

  async sendEvent(pixelId: string, accessToken: string, event: ConversionEvent): Promise<any> {
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
    const payload = {
      data: [{
        event_name: event.eventName,
        event_time: event.eventTime,
        event_source_url: event.eventSourceUrl,
        action_source: event.actionSource ?? 'system_generated',
        user_data: {
          em: event.userData.em,
          ph: event.userData.ph,
          fn: event.userData.fn,
          ln: event.userData.ln,
          external_id: event.userData.externalId,
          ct: event.userData.ct,
          st: event.userData.st,
          country: event.userData.country,
          client_ip_address: event.userData.client_ip_address,
          client_user_agent: event.userData.client_user_agent,
          fbc: event.userData.fbc,
          fbp: event.userData.fbp,
        },
        custom_data: event.customData ? {
          currency: event.customData.currency,
          value: event.customData.value,
          content_ids: event.customData.contentIds,
          content_type: event.customData.contentType,
        } : undefined,
        event_id: event.eventId,
      }],
      access_token: accessToken,
      ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
    };
    try {
      const { data } = await firstValueFrom(
        this.http.post<any>(
          `https://graph.facebook.com/${version}/${pixelId}/events`,
          payload,
          { timeout: 15000 },
        ),
      );
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Meta CAPI failed: ${message}`);
      // Se relanza un error saneado con lo único que el outbox necesita para clasificar:
      // estado y cuerpo de la respuesta. El error original de Axios arrastra `config.data`,
      // que lleva el access token en claro; hoy nadie lo serializa, pero basta con que
      // alguien registre el objeto completo para dejar el token en los logs.
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { status?: number; data?: unknown } }).response;
        throw Object.assign(new BadGatewayException(`Meta Conversions API rejected the event: ${message}`), {
          response: { status: response?.status, data: response?.data },
        });
      }
      throw new BadGatewayException(`Meta Conversions API rejected the event: ${message}`);
    }
  }

  async sendServerEvent(pixelId: string, accessToken: string, event: ConversionEvent): Promise<any> {
    const hashed = {
      ...event.userData,
      em: hashAll(event.userData.em, (value) => value.trim().toLowerCase()),
      ph: hashAll(event.userData.ph, normalizePhoneForMeta),
      fn: hashAll(event.userData.fn, (value) => value.trim().toLowerCase()),
      ln: hashAll(event.userData.ln, (value) => value.trim().toLowerCase()),
      externalId: hashAll(event.userData.externalId, (value) => value),
      // ct/st/country ya llegan normalizados desde geo-inference (minúsculas,
      // sin acentos ni espacios), que es el formato que Meta exige antes de
      // hashear. Se aplica normalizeGeoValue igualmente por si el valor viene
      // de otra fuente.
      ct: hashAll(event.userData.ct, normalizeGeoValue),
      st: hashAll(event.userData.st, normalizeGeoValue),
      country: hashAll(event.userData.country, normalizeGeoValue),
    };
    return this.sendEvent(pixelId, accessToken, { ...event, userData: hashed });
  }
}

/**
 * Normaliza y hashea los valores de un parámetro de identificación.
 *
 * Descarta lo que quede vacío tras normalizar, y omite el parámetro completo si no sobrevive
 * ningún valor. La alternativa —hashear la cadena vacía— produce siempre el mismo digest, de
 * modo que Meta recibiría un identificador idéntico para toda persona cuyo dato no se pudo
 * normalizar y los trataría como una sola.
 *
 * @param values - Valores tal como vienen del evento, o `undefined` si el parámetro no viaja.
 * @param normalize - Formato que Meta exige para ese parámetro antes de hashear.
 * @returns Los digests en hexadecimal, o `undefined` si no queda ninguno que enviar.
 */
function hashAll(values: string[] | undefined, normalize: (value: string) => string): string[] | undefined {
  if (!values?.length) return undefined;
  const hashed = values
    .map((value) => normalize(value ?? ''))
    .filter((value) => value.length > 0)
    .map((value) => createHash('sha256').update(value).digest('hex'));
  return hashed.length > 0 ? hashed : undefined;
}

/**
 * Meta exige que `ph` incluya el código de país, sin ceros a la izquierda, sin símbolos, solo
 * dígitos (ver Customer Information Parameters).
 *
 * Delega en la normalización común para que el mismo teléfono produzca la misma clave acá,
 * en el CRM y en Google. Si difiriera, el hash no casaría con nadie y el evento se aceptaría
 * sin servir para nada — un fallo que no deja ninguna señal.
 */
function normalizePhoneForMeta(phone: string): string {
  return normalizePhoneDigits(phone) ?? '';
}
