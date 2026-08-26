import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { LeadIngestSource } from './ingest-source.entity';
import { LeadIntakeService } from './lead-intake.service';
import { Campaign } from '../campaigns/campaign.entity';
import { IngestLeadDto } from './dto/ingest-lead.dto';
import { identificadorExterno } from './identificador-externo';

/** Prefijo visible de la llave, para reconocerla si aparece pegada en otro sitio. */
const TOKEN_PREFIX = 'esp_in_';

/**
 * Cuánto sigue aceptando la llave anterior tras una rotación.
 *
 * Dos días cubren un fin de semana: si se rota un viernes por la tarde, quien actualiza Make el
 * lunes no pierde nada. Más allá deja de ser una transición y pasan a ser dos llaves vivas, que
 * es lo contrario de rotar.
 */
const GRACIA_LLAVE_ANTERIOR_MS = 48 * 60 * 60 * 1000;

/**
 * Entrada de leads desde integraciones externas.
 *
 * La llave identifica **al origen**, y el origen determina de dónde se dice que viene el lead.
 * Quien llama no lo declara: si lo hiciera, cualquiera con una llave del portal podría marcar sus
 * leads como venidos de una campaña que costó dinero, y el costo por lead quedaría falseado.
 */
@Injectable()
export class LeadIngestService {
  private readonly logger = new Logger(LeadIngestService.name);

  constructor(
    @InjectRepository(LeadIngestSource) private readonly sources: Repository<LeadIngestSource>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    private readonly intake: LeadIntakeService,
  ) {}

  /**
   * Genera una llave nueva y devuelve el valor en claro **una sola vez**.
   *
   * Solo se guarda su huella, igual que una contraseña: quien lea la base no debe poder usar la
   * integración. Recuperarla después es imposible por diseño; se rota y se reconfigura el Zap.
   */
  async issueToken(source: LeadIngestSource): Promise<{ source: LeadIngestSource; token: string }> {
    const token = `${TOKEN_PREFIX}${randomBytes(24).toString('hex')}`;

    /*
     * Al rotar, la anterior sigue sirviendo un rato.
     *
     * Antes moría en el acto, así que entre el clic y el momento en que alguien pegaba la nueva
     * en Make todo lead que llegara se perdía sin dejar rastro: la integración recibía 401 y no
     * quedaba ni como error. El hueco importa justo cuando más urge rotar —una llave filtrada—,
     * porque entonces se rota rápido y se actualiza después.
     *
     * Solo aplica a una rotación: en el alta no hay llave anterior que conservar.
     */
    if (source.tokenHash) {
      source.previousTokenHash = source.tokenHash;
      source.previousTokenExpiresAt = new Date(Date.now() + GRACIA_LLAVE_ANTERIOR_MS);
    }

    source.tokenHash = this.hash(token);
    source.tokenHint = token.slice(-6);
    return { source: await this.sources.save(source), token };
  }

  /**
   * Retira la llave anterior antes de que caduque sola.
   *
   * La gracia existe para no perder leads mientras se actualiza la integración, no para dejar
   * dos llaves vivas por comodidad. Cuando la llave se rotó **porque se filtró**, esperar dos
   * días es exactamente lo que no se quiere: esto la corta ya.
   */
  async revokePreviousToken(source: LeadIngestSource): Promise<LeadIngestSource> {
    source.previousTokenHash = null;
    source.previousTokenExpiresAt = null;
    return this.sources.save(source);
  }

  /**
   * Recibe un lead y lo atribuye al origen de la llave.
   *
   * @param token - Llave enviada en `Authorization: Bearer …`.
   * @throws UnauthorizedException si la llave no existe o el origen está apagado. El mensaje no
   *   distingue ambos casos: decir «la llave existe pero está apagada» confirmaría a un tercero
   *   que acertó una llave válida.
   */
  async ingest(token: string, dto: IngestLeadDto): Promise<{
    leadId: string;
    source: string;
    /**
     * Campaña del lead y si está registrada en el CRM.
     *
     * `null` cuando la entrada no trae ninguna. `recognized: false` no impide que el lead entre:
     * avisa de que su inversión no se podrá repartir, que es un efecto silencioso y por eso hay
     * que decirlo donde se lee, no solo dejarlo pasar.
     */
    campaign: { name: string; recognized: boolean; hint?: string } | null;
  }> {
    const source = await this.buscarPorLlave(token);
    if (!source) throw new UnauthorizedException('Llave de integración no válida');

    try {
      const lead = await this.intake.captureLead({
        organizationId: source.organizationId,
        clientId: source.clientId ?? undefined,
        name: dto.nombre,
        phone: dto.telefono,
        email: dto.email,
        company: dto.empresa,
        source: source.source,
        /*
          La campaña de la llave manda sobre la del cuerpo.

          Antes dependía de que quien configura el escenario escribiera el nombre exactamente
          igual al de la campaña registrada; un espacio de más y el lead entraba con una campaña
          inexistente, la inversión no se repartía y el costo por lead quedaba en nada, sin que
          nada fallara. Con la campaña en la llave no hay nada que escribir bien.

          Las llaves creadas antes no la tienen, y ésas siguen tomando la del cuerpo.
        */
        campaignName: source.campaignName ?? dto.campana,
        notes: dto.mensaje,
        // La fecha del origen, no la de recepción: es lo que hace que el informe por período
        // refleje cuándo llegó la gente y no cuándo la integración logró entregarla.
        sourceCreatedAt: dto.fechaOrigen ? new Date(dto.fechaOrigen) : undefined,
        externalLeadId: identificadorExterno(source.source, dto.idExterno),
        // Las mismas columnas que llena el webhook firmado, para que un lead se vea igual sin
        // importar por cuál de los dos caminos entró.
        externalFormId: dto.formId,
        externalCampaignId: dto.campanaId,
        pageId: dto.paginaId,
        // El anuncio no tiene columna propia y sí la tiene el detalle de Meta: se guarda donde
        // el camino directo ya lo guarda, y no se inventa una columna para un solo dato.
        metadata: dto.anuncioId || dto.metadata
          ? { ...(dto.metadata ?? {}), ...(dto.anuncioId ? { adId: dto.anuncioId } : {}) }
          : undefined,
      });

      // El contador y la fecha se actualizan aparte del lead: si esto fallara, el lead ya está
      // guardado y perder una cifra de diagnóstico no justifica devolver un error que haría a
      // Zapier reintentar y crear un duplicado.
      await this.sources.update(source.id, {
        receivedCount: () => 'received_count + 1',
        lastReceivedAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      }).catch((err) => this.logger.warn(`No se pudo actualizar el contador de ${source.id}: ${err}`));

      /*
       * Si la campaña de este lead está registrada en el CRM.
       *
       * El lead entra igual: no reconocerla no es motivo para rechazarlo, y perder un lead por
       * un nombre mal escrito sería peor que la cifra que se pierde. Pero se dice, porque el
       * efecto de no reconocerla es silencioso: la inversión no se reparte, el costo por lead
       * queda en blanco, y nadie se entera hasta que alguien mira el panel semanas después y no
       * entiende por qué falta esa columna.
       *
       * Va en la respuesta porque es donde lo lee quien está configurando el escenario: Make y
       * Zapier muestran el cuerpo en su historial de ejecuciones, así que el aviso aparece al
       * lado de la petición que lo provocó.
       */
      const campana = source.campaignName ?? dto.campana;
      const reconocida = campana
        ? await this.campaigns.exist({
          where: {
            organizationId: source.organizationId,
            name: campana,
            clientId: source.clientId ?? IsNull(),
          },
        })
        : false;

      return {
        leadId: lead.id,
        source: source.source,
        campaign: campana
          ? {
            name: campana,
            recognized: reconocida,
            ...(reconocida ? {} : {
              hint: 'Esta campaña no está registrada en el CRM: el lead entra igual, pero su '
                + 'inversión y su costo por lead no se podrán calcular. Regístrala en '
                + 'CRM → Administración → Campañas con este mismo nombre.',
            }),
          }
          : null,
      };
    } catch (err) {
      const motivo = err instanceof Error ? err.message : String(err);
      // Se deja anotado en el origen para que la pantalla explique por qué no entra un lead: sin
      // esto, una integración mal configurada se ve igual que una que nadie usó todavía.
      await this.sources.update(source.id, { lastError: motivo.slice(0, 300), lastErrorAt: new Date() })
        .catch(() => undefined);
      throw err;
    }
  }

  /** SHA-256 basta: la llave tiene 24 bytes al azar, no una contraseña que alguien memorice. */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * El origen al que pertenece una llave: la vigente, o la anterior si aún está en gracia.
   *
   * Se busca primero la vigente porque es el caso normal y evita mirar la otra columna en cada
   * lead. Solo si no aparece se prueba la anterior, y ahí la fecha decide: una huella que sigue
   * guardada pero vencida **no** vale, y por eso la comprobación es de fecha y no de presencia.
   *
   * `isActive` gobierna las dos por igual: apagar un origen lo apaga entero, no solo su llave
   * más reciente.
   */
  private async buscarPorLlave(token: string): Promise<LeadIngestSource | null> {
    const huella = this.hash(token);

    const vigente = await this.sources.findOne({ where: { tokenHash: huella, isActive: true } });
    if (vigente) return vigente;

    const anterior = await this.sources.findOne({ where: { previousTokenHash: huella, isActive: true } });
    if (!anterior?.previousTokenExpiresAt) return null;
    if (anterior.previousTokenExpiresAt.getTime() <= Date.now()) return null;

    this.logger.warn(
      `El origen ${anterior.id} recibió un lead con su llave anterior; caduca el `
      + `${anterior.previousTokenExpiresAt.toISOString()}. Actualiza la integración.`,
    );
    return anterior;
  }
}
