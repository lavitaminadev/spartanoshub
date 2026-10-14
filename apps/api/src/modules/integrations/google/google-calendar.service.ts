import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';
import { IntegrationProvider } from '../integration-provider.enum';
import { revealSecret } from '../../../shared/security/integration-secrets';
import { GoogleOAuthService } from './google-oauth.service';

interface CalendarEventInput { summary: string; description?: string; start: Date; durationMinutes: number }

const CALENDARIO = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

@Injectable()
export class GoogleCalendarService {
  constructor(
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
    private readonly oauth: GoogleOAuthService,
  ) {}

  async createEvent(organizationId: string, event: CalendarEventInput) {
    const response = await this.conToken(organizationId, (token) => fetch(`${CALENDARIO}?conferenceDataVersion=1`, {
      method: 'POST', headers: this.cabeceras(token), signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ ...this.cuerpo(event), conferenceData: { createRequest: { requestId: `espartanos-${crypto.randomUUID()}` } } }),
    }));
    const data = await response.json() as { id?: string; htmlLink?: string; hangoutLink?: string; error?: { message?: string } };
    if (!response.ok) throw new BadRequestException(data.error?.message ?? 'Google Calendar event creation failed');
    return { externalId: data.id, calendarUrl: data.htmlLink, meetingLink: data.hangoutLink };
  }

  /**
   * Mueve o reescribe un evento que ya existe.
   *
   * Se usa `PATCH` y no `PUT` a propósito: el evento en Google puede traer invitados, recordatorios
   * o una videollamada que este sistema nunca supo, y reemplazarlo entero los borraría. Así solo se
   * tocan la hora, el título y la descripción.
   *
   * Si Google dice que el evento ya no está —se borró desde el calendario— no es un error: se
   * informa como `{ existe: false }` para que quien llame pueda dejar de apuntar a él.
   *
   * @param eventId - El `calendar_event_id` guardado al crear la reserva.
   */
  async updateEvent(organizationId: string, eventId: string, event: CalendarEventInput): Promise<{ existe: boolean; calendarUrl?: string }> {
    const response = await this.conToken(organizationId, (token) => fetch(`${CALENDARIO}/${encodeURIComponent(eventId)}`, {
      method: 'PATCH', headers: this.cabeceras(token), signal: AbortSignal.timeout(15000),
      body: JSON.stringify(this.cuerpo(event)),
    }));
    if (response.status === 404 || response.status === 410) return { existe: false };
    const data = await response.json() as { htmlLink?: string; error?: { message?: string } };
    if (!response.ok) throw new BadRequestException(data.error?.message ?? 'Google Calendar event update failed');
    return { existe: true, calendarUrl: data.htmlLink };
  }

  /**
   * Borra un evento del calendario.
   *
   * Un evento que ya no está se considera borrado: `404` y `410` devuelven `false` en lugar de
   * fallar, porque el resultado que se buscaba —que no quede en el calendario— ya se cumple y
   * reintentarlo no cambiaría nada.
   *
   * @returns `true` si esta llamada lo borró, `false` si ya no existía.
   */
  async deleteEvent(organizationId: string, eventId: string): Promise<boolean> {
    const response = await this.conToken(organizationId, (token) => fetch(`${CALENDARIO}/${encodeURIComponent(eventId)}`, {
      method: 'DELETE', headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
    }));
    if (response.status === 404 || response.status === 410) return false;
    if (!response.ok) {
      const detalle = await response.text().catch(() => '');
      throw new BadRequestException(`Google Calendar event deletion failed: ${response.status} ${detalle.slice(0, 200)}`);
    }
    return true;
  }

  /**
   * Resuelve el token de la organización y ejecuta la petición, reintentando una vez tras refrescar.
   *
   * Los access tokens pueden revocarse antes de su expiración declarada, de modo que un `401` no
   * significa que la integración esté mal: se refresca y se repite. Un segundo `401` sí se devuelve
   * tal cual para que cada verbo decida qué informar.
   */
  private async conToken(organizationId: string, pedir: (token: string) => Promise<Response>): Promise<Response> {
    let integration = await this.integrations.findOne({ where: { organizationId, provider: IntegrationProvider.GOOGLE } });
    if (!integration) throw new BadRequestException('Google is not connected');
    integration = await this.refreshIfExpiring(integration, organizationId);
    let response = await this.intentar(pedir, this.revealAccessToken(integration));

    if (response.status === 401) {
      integration = await this.oauth.refreshIntegration(integration.id, organizationId);
      response = await this.intentar(pedir, this.revealAccessToken(integration));
    }
    return response;
  }

  private async intentar(pedir: (token: string) => Promise<Response>, token: string): Promise<Response> {
    try {
      return await pedir(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown network error';
      throw new BadRequestException(`Google Calendar request failed: ${message}`);
    }
  }

  private async refreshIfExpiring(integration: Integration, organizationId: string): Promise<Integration> {
    const expiry = typeof integration.config?.expiryDate === 'string' ? new Date(integration.config.expiryDate).getTime() : Number.NaN;
    if (Number.isFinite(expiry) && expiry <= Date.now() + 60_000) return this.oauth.refreshIntegration(integration.id, organizationId);
    return integration;
  }

  private revealAccessToken(integration: Integration): string {
    const token = revealSecret(typeof integration.config?.accessToken === 'string' ? integration.config.accessToken : undefined);
    if (!token) throw new BadRequestException('Google access token is unavailable');
    return token;
  }

  private cabeceras(token: string): Record<string, string> {
    return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  }

  private cuerpo(event: CalendarEventInput) {
    const end = new Date(event.start.getTime() + event.durationMinutes * 60_000);
    return {
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start.toISOString() },
      end: { dateTime: end.toISOString() },
    };
  }
}
