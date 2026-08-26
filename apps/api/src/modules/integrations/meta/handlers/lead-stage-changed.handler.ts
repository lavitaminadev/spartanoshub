import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { STAGE_LABELS_BY_KEY } from '@espartanos/shared';
import { MetaConversionOutboxService } from '../meta-conversion-outbox.service';
import { MetaClientPixelService } from '../meta-client-pixel.service';
import { ClientCapabilityService } from '../../../../core/client-scope/client-capability.service';
import { Lead } from '../../../crm/leads/lead.entity';
import { Campaign } from '../../../crm/campaigns/campaign.entity';

/**
 * Devuelve a Meta en qué etapa quedó cada lead que llegó por un formulario instantáneo.
 *
 * Es un flujo distinto del de una conversión web, y Meta lo trata aparte:
 *
 * - Se identifica por **`lead_id`**, el número que Meta generó al rellenarse el formulario, y no
 *   por correo hasheado. Sin ese número el evento no se puede emparejar con ningún lead suyo, así
 *   que un contacto importado de una planilla o escrito a mano no entra por aquí.
 * - `action_source` es siempre `system_generated`: no ocurrió en una web.
 * - `custom_data.event_source` vale `'crm'`, que es lo que separa estos eventos de los de reserva.
 *
 * Se envían **todas las etapas**, no solo el desenlace, porque es lo que permite a Meta aprender
 * qué anuncios traen gente que avanza y cuáles traen gente que se queda en el primer paso. La
 * bandeja de salida deduplica por `event_id`, así que un lead que va y vuelve entre dos etapas no
 * genera el mismo evento dos veces.
 *
 * Nada de esto sale si la empresa no tiene `metaConversions` contratado: son datos personales
 * hacia un tercero y esa capacidad nace apagada a propósito.
 */
@Injectable()
export class LeadStageChangedHandler {
  private readonly logger = new Logger(LeadStageChangedHandler.name);

  /** Nombre con el que estos eventos aparecen en Events Manager como origen. */
  private static readonly ORIGEN = 'Espartanos';

  constructor(
    private readonly outbox: MetaConversionOutboxService,
    private readonly clientPixels: MetaClientPixelService,
    private readonly capacidades: ClientCapabilityService,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
  ) {}

  @OnEvent('lead.stage-changed')
  async handle(payload: {
    organizationId: string;
    leadId: string;
    clientId: string | null;
    fromStage: string;
    toStage: string;
  }): Promise<void> {
    try {
      const lead = await this.leads.findOne({
        where: { id: payload.leadId, organizationId: payload.organizationId },
      });
      if (!lead) return;

      /*
       * Solo los leads de formularios instantáneos de Meta.
       *
       * `identificadorExterno` guarda el `leadgen_id` tal cual cuando el origen es
       * `meta_lead_ads`, y le antepone el nombre del origen en los demás casos. Un valor con dos
       * puntos no es un identificador de Meta, y mandarlo haría que rechazaran el evento entero.
       */
      if (lead.source !== 'meta_lead_ads') return;
      const leadId = lead.externalLeadId;
      if (!leadId || leadId.includes(':')) return;

      // Sin empresa no hay capacidad que comprobar ni Pixel que heredar: es un prospecto de la
      // agencia y no pertenece a ninguna cuenta publicitaria de cliente.
      if (!payload.clientId) return;
      if (!await this.capacidades.tiene(payload.organizationId, payload.clientId, 'metaConversions')) return;

      const campana = lead.campaignName
        ? await this.campaigns.findOne({
          where: { organizationId: payload.organizationId, name: lead.campaignName, clientId: payload.clientId },
          select: { id: true, metaPixelId: true },
        })
        : null;

      const { pixelId, tokenSource } = await this.clientPixels.resolveForScope(
        payload.organizationId,
        payload.clientId,
        campana?.metaPixelId,
      );
      if (!pixelId) {
        this.logger.warn(`Lead ${lead.id}: sin Pixel configurado; no se reporta la etapa "${payload.toStage}"`);
        return;
      }
      if (tokenSource === 'environment') {
        this.logger.warn(
          `Lead ${lead.id}: el Pixel ${pixelId} no tiene token propio y usará el del entorno; `
          + 'si Meta lo rechaza, configura el token de esa empresa.',
        );
      }

      await this.outbox.enqueue(payload.organizationId, pixelId, {
        /*
         * El nombre de la etapa tal como lo lee el equipo, no la clave interna.
         *
         * Meta acepta cualquier texto acá y lo muestra como está en sus informes: `quote_sent`
         * obligaría a traducir mentalmente en la pantalla de ellos. Se usa el rótulo de fábrica
         * y no el renombrado por empresa, porque si dos empresas llaman distinto a la misma
         * etapa sus eventos dejarían de ser comparables entre sí.
         */
        eventName: STAGE_LABELS_BY_KEY[payload.toStage] ?? payload.toStage,
        eventTime: Math.floor(Date.now() / 1000),
        actionSource: 'system_generated',
        userData: { lead_id: leadId },
        customData: {
          leadEventSource: LeadStageChangedHandler.ORIGEN,
          eventSource: 'crm',
          // El monto solo viaja en la venta: en las etapas intermedias es una estimación, y Meta
          // la contaría como ingreso confirmado.
          value: payload.toStage === 'won' && lead.estimatedAmount ? Number(lead.estimatedAmount) : undefined,
          currency: payload.toStage === 'won' && lead.estimatedAmount ? 'CLP' : undefined,
        },
        /*
         * Estable y por etapa: un lead que vuelve a una etapa por la que ya pasó no genera un
         * evento nuevo. Sin esto, arrastrar una tarjeta de ida y vuelta en el tablero inflaría
         * los conteos de Meta con movimientos que no son avances.
         */
        eventId: `lead-stage:${lead.id}:${payload.toStage}`,
      });
    } catch (error) {
      // Nunca se propaga: reportar una etapa a Meta no puede impedir que el lead se guarde.
      this.logger.error(`No se pudo reportar la etapa del lead ${payload.leadId}:`, error);
    }
  }
}
