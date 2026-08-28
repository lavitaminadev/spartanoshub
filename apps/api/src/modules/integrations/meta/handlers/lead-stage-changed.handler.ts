import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetaConversionOutboxService } from '../meta-conversion-outbox.service';
import { MetaClientPixelService } from '../meta-client-pixel.service';
import { ClientCapabilityService } from '../../../../core/client-scope/client-capability.service';
import { Lead } from '../../../crm/leads/lead.entity';
import { Campaign } from '../../../crm/campaigns/campaign.entity';
import { atribucionDelLead } from '../atribucion-del-lead';

/**
 * Le devuelve a Meta los dos hechos comerciales que puede aprender de un lead.
 *
 * - **`QualifiedLead`**: alguien del equipo afirmó que este lead vale la pena. Es la señal que
 *   Meta usa para optimizar hacia perfiles parecidos, y por eso es la más valiosa de las dos:
 *   llega semanas antes que la venta y hay muchas más.
 * - **`Purchase`**: compró, con el monto.
 *
 * El descarte no se reporta. Meta optimiza hacia lo que recibe y no aprende de lo que le falta;
 * un evento de «este no servía» no le enseña a evitar el perfil, solo diluye el conjunto.
 *
 * Antes se enviaba un evento por cada cambio de etapa, con el nombre de la etapa. Repartía la
 * señal entre siete nombres distintos —cada uno con pocas conversiones— y ninguno acumulaba el
 * volumen que Meta necesita para optimizar. El detalle del embudo se ve en el CRM, que es donde
 * hace falta.
 *
 * Nada de esto sale si la empresa no tiene `metaConversions` contratado: son datos personales
 * hacia un tercero y esa capacidad nace apagada a propósito.
 */
@Injectable()
export class LeadStageChangedHandler {
  private readonly logger = new Logger(LeadStageChangedHandler.name);

  /** Nombre con el que estos eventos aparecen en Events Manager como origen. */
  private static readonly ORIGEN = 'Espartanos';

  /**
   * Forma de un identificador de lead de Meta: 15 a 17 dígitos, nada más.
   *
   * Es la definición de Meta, y comprobarla acá evita mandar valores que van a rechazar. En la
   * base conviven identificadores que no lo son: los de prueba escritos a mano y los de otros
   * orígenes, que llevan el nombre del origen por delante.
   */
  private static readonly LEADGEN_ID = /^\d{15,17}$/;

  constructor(
    private readonly outbox: MetaConversionOutboxService,
    private readonly clientPixels: MetaClientPixelService,
    private readonly capacidades: ClientCapabilityService,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
  ) {}

  @OnEvent('lead.qualified')
  async calificado(payload: { organizationId: string; leadId: string; clientId: string | null }): Promise<void> {
    await this.reportar(payload, 'QualifiedLead', 'calificacion');
  }

  @OnEvent('lead.won')
  async vendido(payload: { organizationId: string; leadId: string; clientId: string | null }): Promise<void> {
    await this.reportar(payload, 'Purchase', 'venta');
  }

  /**
   * Encola el evento si la empresa puede reportar y hay Pixel al que reportar.
   *
   * @param eventName - Nombre estándar de Meta. Genérico y comercial a propósito: sus condiciones
   *   prohíben que el nombre de un evento insinúe una categoría sensible, y desde septiembre de
   *   2025 marcan e inhabilitan las conversiones personalizadas que lo hacen.
   * @param sufijo - Distingue los dos eventos de un mismo lead dentro del `event_id`.
   */
  private async reportar(
    payload: { organizationId: string; leadId: string; clientId: string | null },
    eventName: 'QualifiedLead' | 'Purchase',
    sufijo: 'calificacion' | 'venta',
  ): Promise<void> {
    try {
      const lead = await this.leads.findOne({
        where: { id: payload.leadId, organizationId: payload.organizationId },
      });
      if (!lead) return;

      // Sin empresa no hay capacidad que comprobar ni Pixel que heredar: es un prospecto de la
      // agencia y no pertenece a ninguna cuenta publicitaria de cliente.
      if (!payload.clientId) return;
      if (!await this.capacidades.tiene(payload.organizationId, payload.clientId, 'metaConversions')) return;

      const campana = lead.campaignName
        ? await this.campaigns.findOne({
          where: { organizationId: payload.organizationId, name: lead.campaignName, clientId: payload.clientId },
          select: { id: true, metaPixelId: true, metaCapiEnabled: true },
        })
        : null;

      // Una campaña puede quedar fuera del reporte sin apagar el CRM entero: es la excepción
      // para las de prueba o las que todavía no tienen su Pixel listo.
      if (campana && campana.metaCapiEnabled === false) return;

      const { pixelId, tokenSource } = await this.clientPixels.resolveForScope(
        payload.organizationId,
        payload.clientId,
        campana?.metaPixelId,
      );
      if (!pixelId) {
        this.logger.warn(`Lead ${lead.id}: sin Pixel configurado; no se reporta «${eventName}»`);
        return;
      }
      if (tokenSource === 'environment') {
        this.logger.warn(
          `Lead ${lead.id}: el Pixel ${pixelId} no tiene token propio y usará el del entorno; `
          + 'si Meta lo rechaza, configura el token de esa empresa.',
        );
      }

      /*
       * Todo lo que se sepa de cómo llegó esta persona.
       *
       * Se guardó al capturarla y no ahora: `fbp`, `fbc`, la IP y el navegador describen el
       * momento en que llegó, y ese momento no vuelve. Lo que no exista se omite —un dato
       * inventado produce un hash que no empareja con nadie y le enseña algo falso a Meta—.
       */
      const atribucion = atribucionDelLead(lead);

      /*
       * El `lead_id` de Meta cuando lo hay, y los contactos siempre.
       *
       * Antes solo se reportaban los leads de formularios instantáneos, porque solo ellos tienen
       * ese número. Pero el correo y el teléfono emparejan igual, así que un lead que llegó por
       * la web o por teléfono también puede enseñarle a Meta a qué perfil apuntar; excluirlo era
       * tirar la mitad de la señal.
       *
       * Van sin hashear desde acá **a propósito**: la cola aplica SHA-256 con la normalización
       * que Meta exige. Hashear dos veces produce un valor que no empareja con nada.
       */
      const leadId = lead.source === 'meta_lead_ads' && lead.externalLeadId
        && LeadStageChangedHandler.LEADGEN_ID.test(lead.externalLeadId)
        ? lead.externalLeadId
        : undefined;

      const monto = lead.estimatedAmount ? Number(lead.estimatedAmount) : undefined;

      await this.outbox.enqueue(payload.organizationId, pixelId, {
        eventName,
        eventTime: Math.floor(Date.now() / 1000),
        actionSource: 'system_generated',
        userData: {
          lead_id: leadId,
          em: lead.email ? [lead.email] : undefined,
          ph: lead.phone ? [lead.phone] : undefined,
          externalId: [lead.id],
          fbp: atribucion.fbp,
          fbc: atribucion.fbc,
          client_ip_address: atribucion.clientIpAddress,
          client_user_agent: atribucion.clientUserAgent,
        },
        customData: {
          leadEventSource: LeadStageChangedHandler.ORIGEN,
          eventSource: 'crm',
          /*
           * El monto solo viaja en la venta.
           *
           * En cualquier otro momento es una estimación, y Meta lo trataría como ingreso
           * confirmado. Una calificación no vale dinero: vale como señal de perfil.
           */
          value: eventName === 'Purchase' && monto && monto > 0 ? monto : undefined,
          currency: eventName === 'Purchase' && monto && monto > 0 ? 'CLP' : undefined,
        },
        /*
         * Estable por lead y por hecho: un lead que se descalifica y se vuelve a calificar no
         * genera un evento nuevo, y guardar la ficha otra vez tampoco. Sin esto, cada guardado
         * inflaría los conteos de Meta con movimientos que no son conversiones.
         */
        eventId: `lead-${sufijo}:${lead.id}`,
      });
    } catch (error) {
      // Nunca se propaga: reportar a Meta no puede impedir que el lead se guarde.
      this.logger.error(`No se pudo reportar «${eventName}» del lead ${payload.leadId}:`, error);
    }
  }
}
