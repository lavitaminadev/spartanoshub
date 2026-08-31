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

/** Lo que acompaña a cualquier señal de un lead. La empresa decide Pixel y permiso. */
type SenalDeLead = { organizationId: string; leadId: string; clientId: string | null };

/**
 * Le devuelve a Meta el recorrido de un lead por el embudo del CRM.
 *
 * Cuatro etapas, y las cuatro hacen falta:
 *
 * - **Lead recibido**: uno por cada lead que entra. No es una etapa que nadie trabaje: es el
 *   denominador. La integración calcula la tasa de conversión como «calificados sobre leads
 *   recibidos», así que sin esto no hay con qué dividir y el requisito del 1-40% no se puede
 *   evaluar siquiera. Es también lo que le dice a Meta que el lead llegó y se procesó.
 * - **Calificado**: alguien del equipo afirmó que este perfil interesa. Es la señal más
 *   valiosa porque es un juicio humano que no se deduce de ningún comportamiento, y llega
 *   semanas antes que la venta.
 * - **Vendido**: el desenlace. Lleva el importe cuando se anotó.
 * - **Descartado**: el contraste. En Events Manager se clasifica como «otra etapa» y le
 *   enseña a Meta qué perfiles no busca.
 *
 * Las etapas intermedias —contactado, reunión agendada, cotización— **no se envían**. Son
 * pasos de proceso, no de valor: se contacta a todos y se agenda para averiguar. Mandarlas
 * diluye la señal y, si una de ellas cubriera casi todos los leads, sacaría a la etapa
 * optimizada del rango de conversión que la integración exige.
 *
 * **Los nombres son libres, nunca eventos estándar.** La especificación de la integración de
 * CRM define `event_name` como «campo sin formato para capturar las etapas que usas en tu
 * CRM». Usar `Purchase` hacía que Meta aplicara la validación del evento estándar, que exige
 * `value` y `currency`: las ventas sin importe se rechazaban con «code=100 subcode=2804010» y
 * la conversión se perdía en la cola de fallidos.
 *
 * **Cada etapa exige las anteriores.** La especificación lo dice sin rodeos: si un lead llega
 * a la última etapa, las previas ya tienen que haberse enviado. Por eso una venta arrastra la
 * calificación aunque nadie la haya marcado a mano; el identificador de evento es estable, así
 * que si ya se envió, la cola la reconoce y no la duplica.
 *
 * Nada de esto sale si la empresa no tiene `metaConversions` contratado: son datos personales
 * hacia un tercero y esa capacidad nace apagada a propósito.
 *
 * @see docs/meta-conversion-leads.md
 */
@Injectable()
export class LeadStageChangedHandler {
  private readonly logger = new Logger(LeadStageChangedHandler.name);

  /**
   * Los nombres con que cada etapa aparece en Events Manager.
   *
   * Se escriben una vez acá porque son la clave con la que se configura el embudo en la
   * interfaz de Meta: cambiarlos después parte el histórico en dos series que no se suman, y
   * obliga a rehacer la clasificación de etapas positivas.
   *
   * Son deliberadamente neutros. Las condiciones de Meta prohíben que el nombre de un evento
   * insinúe una categoría sensible, y desde septiembre de 2025 inhabilitan las conversiones
   * personalizadas que lo hacen.
   */
  static readonly ETAPAS = {
    recibido: 'Lead recibido',
    calificacion: 'Calificado',
    venta: 'Vendido',
    descarte: 'Descartado',
  } as const;

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

  /** Un lead entró al CRM. La primera etapa, la que todos recorren. */
  @OnEvent('lead.received')
  async recibido(payload: SenalDeLead): Promise<void> {
    await this.reportar(payload, 'recibido');
  }

  /** Alguien afirmó que el lead vale la pena. */
  @OnEvent('lead.qualified')
  async calificado(payload: SenalDeLead): Promise<void> {
    await this.reportar(payload, 'calificacion');
  }

  /**
   * Se cerró la venta.
   *
   * Arrastra la calificación: vender es la afirmación más fuerte de que el lead encajaba, y la
   * integración exige que las etapas previas ya se hayan enviado. Si la calificación ya salió,
   * el identificador estable hace que la cola la reconozca y no la repita.
   */
  @OnEvent('lead.won')
  async vendido(payload: SenalDeLead): Promise<void> {
    await this.reportar(payload, 'calificacion');
    await this.reportar(payload, 'venta');
  }

  /** El lead se descartó. Viaja como «otra etapa» para que Meta aprenda el contraste. */
  @OnEvent('lead.discarded')
  async descartado(payload: SenalDeLead): Promise<void> {
    await this.reportar(payload, 'descarte');
  }

  /**
   * Encola una etapa si la empresa puede reportar y hay Pixel al que reportar.
   *
   * @param etapa - Cuál de las cuatro. Da a la vez el nombre visible en Events Manager y el
   *   sufijo del `event_id`, de modo que no puedan divergir.
   */
  private async reportar(payload: SenalDeLead, etapa: keyof typeof LeadStageChangedHandler.ETAPAS): Promise<void> {
    try {
      const lead = await this.leads.findOne({
        where: { id: payload.leadId, organizationId: payload.organizationId },
      });
      if (!lead) return;

      /*
       * Un lead marcado como excluido no se reporta, en ninguna etapa.
       *
       * Es la alternativa a borrarlo: pruebas internas, duplicados y formularios mal
       * configurados dejan de enseñarle a Meta un perfil que no queremos que aprenda, sin
       * perder el lead ni lo que cuelga de él.
       *
       * Se comprueba acá y no en la cola porque la exclusión se decide antes: lo que no debe
       * salir tampoco tiene por qué ocupar una fila esperando a que alguien la mire.
       */
      if (lead.excludedFromMeta) return;

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
        this.logger.warn(`Lead ${lead.id}: sin Pixel configurado; no se reporta «${LeadStageChangedHandler.ETAPAS[etapa]}»`);
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

      /*
       * El importe solo viaja con la venta, y solo si alguien lo anotó.
       *
       * En cualquier otra etapa sería una estimación, y Meta la trataría como ingreso
       * confirmado. Una calificación no vale dinero: vale como señal de perfil.
       *
       * Que falte ya no rompe nada. Con el nombre de etapa libre no hay validación de evento
       * estándar que exija `value` y `currency`, así que una venta sin monto se reporta igual
       * en vez de perderse.
       */
      const monto = lead.estimatedAmount ? Number(lead.estimatedAmount) : undefined;
      const conMonto = etapa === 'venta' && Boolean(monto && monto > 0);


      await this.outbox.enqueue(payload.organizationId, pixelId, {
        eventName: LeadStageChangedHandler.ETAPAS[etapa],
        eventTime: Math.floor(Date.now() / 1000),
        actionSource: 'system_generated',
        userData: {
          lead_id: leadId,
          em: lead.email ? [lead.email] : undefined,
          ph: lead.phone ? [lead.phone] : undefined,
          /*
           * Nombre y apellido suben la calidad del emparejamiento.
           *
           * Meta puntúa cuántos identificadores manda cada evento y qué porcentaje empareja;
           * cada parámetro más es una vía más de encontrar a la misma persona. Se parten del
           * nombre completo, que es como lo guarda el CRM, y la cola los normaliza y hashea.
           */
          fn: partirNombre(lead.name).nombre,
          ln: partirNombre(lead.name).apellido,
          /*
           * El país siempre, aunque sea uno solo.
           *
           * Meta lo pide explícitamente: empareja a escala global, y sin país tiene que
           * distinguir entre cuentas de todo el mundo con los demás datos.
           */
          country: ['cl'],
          externalId: [lead.id],
          fbp: atribucion.fbp,
          fbc: atribucion.fbc,
          client_ip_address: atribucion.clientIpAddress,
          client_user_agent: atribucion.clientUserAgent,
        },
        customData: {
          leadEventSource: LeadStageChangedHandler.ORIGEN,
          eventSource: 'crm',
          value: conMonto ? monto : undefined,
          currency: conMonto ? 'CLP' : undefined,
        },
        /*
         * Estable por lead y por hecho: un lead que se descalifica y se vuelve a calificar no
         * genera un evento nuevo, y guardar la ficha otra vez tampoco. Sin esto, cada guardado
         * inflaría los conteos de Meta con movimientos que no son conversiones.
         */
        eventId: `lead-${etapa}:${lead.id}`,
      });
    } catch (error) {
      // Nunca se propaga: reportar a Meta no puede impedir que el lead se guarde.
      this.logger.error(`No se pudo reportar «${LeadStageChangedHandler.ETAPAS[etapa]}» del lead ${payload.leadId}:`, error);
    }
  }
}

/**
 * Parte un nombre completo en nombre y apellidos.
 *
 * El CRM guarda un solo campo porque es lo que llega de los formularios de Meta y de la web.
 * Se toma la primera palabra como nombre y el resto como apellido: en Chile lo habitual son dos
 * apellidos, y mandar los dos juntos empareja mejor que mandar solo uno.
 *
 * Un nombre de una sola palabra devuelve nombre y ningún apellido, no un apellido vacío: un
 * valor en blanco produce un hash que no empareja con nadie y ensucia el evento.
 */
function partirNombre(completo: string | null | undefined): { nombre?: string[]; apellido?: string[] } {
  const partes = String(completo ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return {};
  if (partes.length === 1) return { nombre: [partes[0]] };
  return { nombre: [partes[0]], apellido: [partes.slice(1).join(' ')] };
}
