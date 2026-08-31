import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { parametroSinHashear, prepararIdentificadores } from './identificadores-meta';
import { construirEventoPermitido, registrarBloqueo, resumenAuditable, revisarEvento } from './politica-meta-capi';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BadGatewayException } from '@nestjs/common';
import { sinCredenciales } from './sin-credenciales';

export interface ConversionEvent {
  eventName: string;
  eventSourceUrl?: string;
  eventTime: number;
  actionSource?: string;
  userData: {
    em?: string[];
    ph?: string[];
    fn?: string[];
    ln?: string[];
    /** Ciudad normalizada: minúsculas, sin acentos ni espacios. */
    ct?: string[];
    /** Región o estado, normalizado igual que la ciudad. */
    st?: string[];
    /** ISO 3166-1 alpha-2 en minúsculas, ej. `cl`. */
    country?: string[];
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string;
    fbp?: string;
    externalId?: string[];
    /**
     * Identificador que Meta generó al rellenarse el formulario instantáneo.
     *
     * **No se hashea.** Es un número de Meta, no un dato personal: hashearlo lo vuelve
     * irreconocible para ellos y el evento deja de emparejarse con su lead. Por eso viaja
     * aparte de `externalId`, que sí pasa por SHA-256.
     */
    lead_id?: string;
  };
  customData?: {
    currency?: string;
    value?: number;
    contentIds?: string[];
    contentType?: string;
    /** Nombre de la herramienta que reporta. Meta lo pide para los eventos de CRM. */
    leadEventSource?: string;
    /** `'crm'` en los eventos de etapa. Es lo que los separa de una conversión web. */
    eventSource?: string;
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
          ct: event.userData.ct,
          st: event.userData.st,
          country: event.userData.country,
          external_id: event.userData.externalId,
          lead_id: event.userData.lead_id,
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
          lead_event_source: event.customData.leadEventSource,
          event_source: event.customData.eventSource,
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
      // Meta repite el token en el mensaje cuando lo rechaza por malformado, y este texto
      // termina en el registro y en la columna de errores de la cola.
      const message = sinCredenciales(error instanceof Error ? error.message : 'Unknown error');
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

  /**
   * Envía un evento dejando primero los identificadores en el formato que Meta exige.
   *
   * El hasheo se aplica también al encolar, así que casi siempre llega hecho: acá se repite
   * porque `prepararIdentificadores` reconoce lo ya hasheado y lo deja intacto, y porque un
   * registro encolado antes de ese cambio no puede salir en claro por venir de la cola vieja.
   */
  async sendServerEvent(pixelId: string, accessToken: string, event: ConversionEvent): Promise<any> {
    /*
     * Control 2: la lista blanca se vuelve a aplicar acá, sobre el evento que salió de la cola.
     *
     * El control del encolado no sirve para las filas que ya estaban guardadas ni para cualquier
     * camino que llegue a enviar sin pasar por el outbox. Como esta es la única función que hace
     * el POST, revisar acá cubre todo lo que sale del sistema hacia Meta.
     */
    const infracciones = revisarEvento(event as unknown as Record<string, unknown>);
    if (infracciones.length > 0) {
      registrarBloqueo(event.eventId, infracciones);
      throw new BadRequestException(
        `Meta CAPI: el evento incluye campos no autorizados (${infracciones.map((i) => `${i.seccion}.${i.campo}`).join(', ')})`,
      );
    }

    const permitido = construirEventoPermitido(event as unknown as Record<string, unknown>) as unknown as ConversionEvent;
    const userData = prepararIdentificadores(permitido.userData);

    /*
     * Última reja antes del POST.
     *
     * Si algún camino deja de hashear, el evento no sale. Perder una conversión es reparable
     * —queda en la cola con su motivo— y entregar datos personales en claro a un tercero no lo
     * es. El mensaje nombra el parámetro y nunca su contenido.
     */
    const enClaro = parametroSinHashear(userData as unknown as Record<string, unknown>);
    if (enClaro) {
      throw new BadRequestException(
        `Meta CAPI: el parámetro «${enClaro}» no viaja hasheado y el evento no se envía`,
      );
    }

    // Queda constancia de qué campos viajaron —no de su contenido— para poder auditar después
    // qué se le entregó a Meta por cada evento.
    this.logger.log(`META_CAPI_SENT ${resumenAuditable({ ...permitido, userData })}`);

    return this.sendEvent(pixelId, accessToken, { ...permitido, userData });
  }
}
