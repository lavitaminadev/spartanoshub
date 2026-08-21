import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Campaign } from './campaign.entity';
import { Lead } from '../leads/lead.entity';
import { LeadIngestSource } from '../leads/ingest-source.entity';
import { LeadIngestService } from '../leads/lead-ingest.service';
import type { SaveCampaignDto } from './dto/save-campaign.dto';

/** Una campaña con lo que ya se puede medir de ella. */
export interface CampaignWithCost {
  id: string;
  name: string;
  source: string;
  clientId?: string | null;
  investment: number;
  status: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  /** Leads que declararon venir de esta campaña. */
  leads: number;
  /** Inversión dividida entre esos leads. `null` cuando todavía no llegó ninguno. */
  costPerLead: number | null;
}

/**
 * Campañas y su costo por lead.
 *
 * El conteo de leads no se guarda: se cuenta al preguntar. Un contador acumulado se desincroniza
 * en cuanto alguien corrige o borra un lead a mano, y entonces el costo por lead sigue mostrando
 * un número que ya no corresponde a nada, sin que nada falle.
 */
@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(LeadIngestSource) private readonly sources: Repository<LeadIngestSource>,
    private readonly ingest: LeadIngestService,
  ) {}

  /**
   * Campañas de una cuenta, o las de la agencia cuando no se pide ninguna.
   *
   * @param clientId - Cuenta cuyo panel se está mirando. Sin valor devuelve las que no tienen
   *   cuenta, que son las de la propia agencia: mezclarlas daría un gasto total que no
   *   corresponde a ninguna de las dos lecturas.
   */
  async list(organizationId: string, clientId?: string): Promise<CampaignWithCost[]> {
    const campanias = await this.campaigns.find({
      where: { organizationId, clientId: clientId ?? IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!campanias.length) return [];

    const conteos = await this.leadsPorCampania(organizationId, campanias.map((c) => c.name));

    return campanias.map((campania) => {
      const leads = conteos.get(campania.name) ?? 0;
      const investment = Number(campania.investment) || 0;
      return {
        id: campania.id,
        name: campania.name,
        source: campania.source,
        clientId: campania.clientId,
        investment,
        status: campania.status,
        startsAt: campania.startsAt,
        endsAt: campania.endsAt,
        leads,
        // `null` y no cero: cero costo por lead diría que salieron gratis, y lo que ocurre es
        // que todavía no hay con qué dividir.
        costPerLead: leads > 0 ? Math.round(investment / leads) : null,
      };
    });
  }

  /**
   * Da de alta la campaña y **su llave de entrada**.
   *
   * Las dos cosas juntas y no en dos pasos: una campaña sin por dónde recibir leads no mide
   * nada, y una llave sin campaña obliga a que quien configura el escenario escriba el nombre
   * exactamente igual —el error que dejaba el costo por lead en nada—. Creadas juntas, la llave
   * ya sabe a qué cuenta y a qué campaña pertenece lo que entre por ella.
   *
   * La llave se devuelve **una sola vez**. En base queda su huella, no la llave: si se pierde,
   * se rota desde la administración del CRM y la anterior deja de servir en el acto.
   */
  async create(
    organizationId: string,
    dto: SaveCampaignDto,
    createdBy?: string,
  ): Promise<{ campaign: Campaign; token: string }> {
    const campaign = await this.campaigns.save(this.campaigns.create({
      organizationId,
      name: dto.name.trim(),
      source: dto.source ?? 'Meta Ads',
      clientId: dto.clientId ?? null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      investment: dto.investment ?? 0,
      status: dto.status ?? 'active',
    }));

    const { token } = await this.ingest.issueToken(this.sources.create({
      organizationId,
      clientId: campaign.clientId ?? null,
      // El origen se llama como la campaña: es lo que se lee en la administración al revisar
      // por qué no entran leads, y buscar por otro nombre es una traducción mental de más.
      name: campaign.name,
      source: campaign.source,
      campaignName: campaign.name,
      isActive: true,
      createdBy: createdBy ?? null,
    }));

    return { campaign, token };
  }

  async update(id: string, organizationId: string, dto: SaveCampaignDto): Promise<Campaign> {
    const campania = await this.campaigns.findOne({ where: { id, organizationId } });
    if (!campania) throw new NotFoundException('Campaña no encontrada');

    campania.name = dto.name.trim();
    if (dto.source !== undefined) campania.source = dto.source;
    // `null` la devuelve a la agencia; omitirla no toca a qué cuenta pertenece.
    if (dto.clientId !== undefined) campania.clientId = dto.clientId;
    if (dto.startsAt !== undefined) campania.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined) campania.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.investment !== undefined) campania.investment = dto.investment;
    if (dto.status !== undefined) campania.status = dto.status;

    return this.campaigns.save(campania);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const resultado = await this.campaigns.delete({ id, organizationId });
    if (!resultado.affected) throw new NotFoundException('Campaña no encontrada');
  }

  /**
   * Cuántos leads declara cada campaña, en una sola consulta.
   *
   * Se agrupa en base y no se cuenta campaña por campaña: con veinte campañas serían veinte
   * viajes a la base cada vez que alguien abre el panel.
   */
  private async leadsPorCampania(organizationId: string, nombres: string[]): Promise<Map<string, number>> {
    const filas = await this.leads.createQueryBuilder('lead')
      .select('lead.campaign_name', 'name')
      .addSelect('COUNT(*)', 'total')
      .where('lead.organization_id = :organizationId', { organizationId })
      .andWhere('lead.campaign_name IN (:...nombres)', { nombres })
      .groupBy('lead.campaign_name')
      .getRawMany<{ name: string; total: string }>();

    return new Map(filas.map((fila) => [fila.name, Number(fila.total) || 0]));
  }
}
