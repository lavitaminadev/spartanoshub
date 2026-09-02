import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { MetaConversionOutboxService } from '../meta-conversion-outbox.service';
import { MetaClientPixelService } from '../meta-client-pixel.service';
import { IntegrationAccount } from '../../integration-account.entity';
import { IntegrationAccountType } from '../../integration-account-type.enum';
import { Lead } from '../../../crm/leads/lead.entity';
import { Client } from '../../../clients/client.entity';
import { Campaign } from '../../../crm/campaigns/campaign.entity';
import { atribucionDelLead } from '../atribucion-del-lead';

/** Forma de un identificador de lead de Meta: 15 a 17 dígitos, nada más. */
const LEADGEN_ID = /^\d{15,17}$/;

@Injectable()
export class LeadConvertedHandler {
  private readonly logger = new Logger(LeadConvertedHandler.name);

  constructor(
    private readonly outbox: MetaConversionOutboxService,
    private readonly clientPixels: MetaClientPixelService,
    @InjectRepository(IntegrationAccount) private readonly accountsRepo: Repository<IntegrationAccount>,
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    @InjectRepository(Campaign) private readonly campaignRepo: Repository<Campaign>,
  ) {}

  @OnEvent('lead.converted')
  async handleLeadConvertedEvent(payload: { organizationId: string; leadId: string; clientId: string }) {
    try {
      const lead = await this.leadRepo.findOne({ where: { id: payload.leadId, organizationId: payload.organizationId } });
      if (!lead || !lead.email && !lead.phone) return;

      // Verifica que el lead haya venido originalmente de Meta
      if (lead.source !== 'meta_lead_ads' && !lead.metadata?.adId) return;

      // `pageId` es columna propia del lead (ver LeadIntakeService/MetaLeadAdsService), no viaja
      // dentro de `metadata`: ahi solo se guardan adId/adsetId/formId/etc.
      const pageId = lead.pageId;
      if (!pageId) return;

      const pageAccount = await this.accountsRepo.findOne({
        where: {
          accountType: IntegrationAccountType.PAGE,
          externalId: pageId,
          integration: { organizationId: lead.organizationId },
        },
        relations: { integration: true },
      });

      if (!pageAccount?.integration) return;

      // El Pixel se resuelve por cliente, igual que en el camino de reservas. Antes se leía
      // `config.pixelId`, que es un único valor de la organización: en una agencia con varias
      // cuentas eso mandaba la conversión de un cliente al Pixel del último que se validó,
      // junto con el importe de su retainer.
      /*
       * La campaña puede medir contra su propio Pixel.
       *
       * Dos campañas de la misma empresa pueden anunciar marcas distintas, cada una con su
       * cuenta publicitaria. Sin campaña declarada —o sin Pixel propio en ella— hereda el de la
       * empresa, que es como funcionó siempre.
       */
      /*
       * La campaña que trajo al prospecto es de la agencia, no de la empresa que acaba de nacer.
       *
       * Se buscaba con el cliente recién creado, así que nunca encontraba nada y el interruptor
       * de reporte de esa campaña no se leía jamás. Ahora se busca en el embudo propio, donde las
       * campañas no tienen empresa.
       */
      const campana = lead.campaignName
        ? await this.campaignRepo.findOne({
          where: { organizationId: lead.organizationId, name: lead.campaignName, clientId: IsNull() },
          select: { id: true, metaCapiEnabled: true },
        })
        : null;

      // Una campaña puede quedar fuera del reporte sin apagar nada más. Faltaba: la columna ni
      // siquiera se traía, así que apagarla no surtía efecto en este camino.
      if (campana && campana.metaCapiEnabled === false) return;

      /*
       * Va al Pixel de la agencia, no al del cliente.
       *
       * Esta conversión es de Espartanos: un prospecto suyo se convirtió en empresa cliente, y el
       * `value` es el retainer que la agencia va a cobrar. Resolverlo contra el Pixel del cliente
       * recién creado publicaba en su Events Manager un evento valorado en lo que le paga a la
       * agencia.
       *
       * Sin Pixel de agencia marcado no se envía nada, y eso **es** el interruptor: marcarlo es
       * el consentimiento explícito que en las empresas da la capacidad contratada.
       */
      const { pixelId, accessToken } = await this.clientPixels.resolveAgencia(lead.organizationId);
      if (!pixelId) {
        this.logger.warn(`Lead ${lead.id}: la agencia no tiene Pixel propio marcado; no se encola su conversión`);
        return;
      }
      if (!accessToken) {
        this.logger.warn(`Lead ${lead.id}: el Pixel de la agencia ${pixelId} no tiene token; no se encola su conversión`);
        return;
      }
      const client = await this.clientRepo.findOne({ where: { id: payload.clientId, organizationId: lead.organizationId } });
      const eventId = `lead-converted:${lead.id}:${payload.clientId}`;

      // Incluye el `fbc` reconstruido desde el `fbclid` cuando la página no tenía el Pixel.
      const attribution = atribucionDelLead(lead);

      await this.outbox.enqueue(lead.organizationId, pixelId, {
        eventName: 'QualifiedLead',
        eventTime: Math.floor(Date.now() / 1000),
        actionSource: 'system_generated',
        userData: {
          // Si el prospecto vino de un formulario instantáneo, su identificador de Meta es el
          // emparejador más fuerte. Va sin hashear: es un número que generó Meta, no un dato
          // personal, y hashearlo lo vuelve irreconocible para ellos.
          lead_id: LEADGEN_ID.test(lead.externalLeadId ?? '') ? lead.externalLeadId as string : undefined,
          em: lead.email ? [lead.email] : undefined,
          ph: lead.phone ? [lead.phone] : undefined,
          externalId: [lead.id],
          fbp: attribution.fbp,
          fbc: attribution.fbc,
          client_ip_address: attribution.clientIpAddress,
          client_user_agent: attribution.clientUserAgent,
        },
        customData: {
          currency: 'CLP',
          value: client?.retainerAmount ? Number(client.retainerAmount) : undefined,
        },
        eventId,
      });
      this.logger.log(`CAPI event queued for Lead ${lead.id}`);
    } catch (error) {
      this.logger.error(`Error sending CAPI event for Lead ${payload.leadId}:`, error);
    }
  }
}
