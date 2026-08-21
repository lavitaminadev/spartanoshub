import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { Lead } from './lead.entity';
import { LeadStatus } from './lead-status.enum';
import { User } from '../../users/user.entity';

/** Un lead resumido a lo que hace falta para reconocerlo en un aviso. */
export interface HomeLeadPreview {
  id: string;
  name: string;
  source?: string | null;
  campaignName?: string | null;
  assignedToName?: string | null;
  createdAt: Date;
}

/** Un aviso del inicio: cuántos, y un ejemplo para no tener que ir a buscarlo. */
export interface HomeAlert {
  key: string;
  count: number;
  sample: HomeLeadPreview | null;
}

/** Carga de una persona del equipo. */
export interface TeamLoadRow {
  userId: string;
  name: string;
  open: number;
  uncontacted: number;
  cooling: number;
}

/**
 * Estados en que un lead ya no espera gestión.
 *
 * `no_show` cuenta como cerrado: quien no llegó a su cita se retoma abriendo un lead nuevo, no
 * dejando el anterior corriendo. Si se contara como abierto, inflaría la carga de todo el equipo
 * con trabajo que nadie va a hacer.
 */
const CLOSED_STATUSES: LeadStatus[] = [LeadStatus.WON, LeadStatus.LOST, LeadStatus.NO_SHOW];

/**
 * Lo que se responde al entrar al CRM.
 *
 * La pantalla no abre con una lista sino con lo que hay que atender: quién no ha sido contactado,
 * quién no tiene dueño, y quién está listo para avanzar y nadie movió. Una lista obliga a decidir
 * qué mirar; un aviso ya lo decidió.
 *
 * Cada aviso trae **un ejemplo concreto** además del número. Sin él, «3 leads sin contactar» manda
 * a buscarlos a otra pantalla, y el aviso se vuelve un recordatorio en vez de un punto de partida.
 */
@Injectable()
export class CrmHomeService {
  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /**
   * @param coolingDays - Días sin movimiento tras los que un lead se considera enfriándose.
   *   Es configuración y no una constante porque el plazo razonable depende del negocio: en una
   *   venta de departamentos no es el mismo que en una consulta de agenda.
   * @param alcance - Empresa cuyo CRM se está mirando, tal como la eligió la barra. Sin esto el
   *   inicio respondía siempre por toda la organización, así que cambiar de empresa arriba
   *   dejaba los avisos y la carga del equipo mostrando lo de antes.
   */
  async home(organizationId: string, coolingDays = 7, alcance: { domain?: 'audience' | 'commercial'; clientId?: string } = {}) {
    const inicioDeMes = new Date();
    inicioDeMes.setDate(1);
    inicioDeMes.setHours(0, 0, 0, 0);

    const limiteFrio = new Date(Date.now() - coolingDays * 86_400_000);
    // Se compone una vez y se reparte: con seis consultas, repetir el filtro dejaba que alguna
    // se olvidara y contara leads de otra empresa dentro del inicio de ésta.
    const base = {
      organizationId,
      domain: alcance.domain ?? 'commercial',
      ...(alcance.clientId ? { clientId: alcance.clientId } : {}),
    };
    const abierto = { ...base, status: In(this.openStatuses()) };

    const [delMes, ventasDelMes, montoDelMes, sinContactar, sinAsignar, calificadosSinVisita, equipo] = await Promise.all([
      this.leads.count({ where: { ...base, createdAt: MoreThanOrEqual(inicioDeMes) } as never }),
      this.leads.count({ where: { ...base, status: LeadStatus.WON, updatedAt: MoreThanOrEqual(inicioDeMes) } as never }),
      this.montoDelMes(base, inicioDeMes),
      this.alert('sin_contactar', { ...abierto, status: LeadStatus.NEW }),
      this.alert('sin_asignar', { ...abierto, assignedTo: IsNull() }),
      /*
       * Calificado y todavía sin visita agendada.
       *
       * Basta con mirar la etapa: el embudo es secuencial y agendar la visita mueve el lead a la
       * siguiente. Comprobar además que no exista una visita sería preguntar dos veces lo mismo,
       * y cualquier discrepancia entre ambas respuestas dejaría el aviso mintiendo.
       */
      this.alert('calificados_sin_visita', {
        ...base,
        status: LeadStatus.QUOTE_SENT,
      }),
      this.teamLoad(base, limiteFrio),
    ]);

    const alerts = [sinContactar, sinAsignar, calificadosSinVisita].filter((a) => a.count > 0);

    return {
      month: { leads: delMes, ventas: ventasDelMes, monto: montoDelMes },
      // Se envía el total de avisos y no solo la lista para que el saludo pueda decir cuántos hay
      // sin que la pantalla tenga que contarlos y arriesgarse a discrepar con lo que muestra.
      urgentCount: alerts.length,
      alerts,
      team: equipo,
      coolingDays,
    };
  }

  /** Suma vendida en el mes. Se usa COALESCE porque sin ventas la suma es nula, no cero. */
  private async montoDelMes(base: Record<string, unknown>, desde: Date): Promise<number> {
    const fila = await this.acotar(this.leads.createQueryBuilder('lead'), base)
      .select('COALESCE(SUM(lead.estimated_amount), 0)', 'total')
      .andWhere('lead.status = :status', { status: LeadStatus.WON })
      .andWhere('lead.updated_at >= :desde', { desde })
      .getRawOne<{ total: string }>();
    return Number(fila?.total ?? 0);
  }

  /**
   * Aplica el alcance —organización, embudo y empresa— a una consulta del inicio.
   *
   * En un solo sitio porque son seis: repetirlo dejaba que alguna se olvidara del filtro y
   * contara leads de otra empresa dentro del inicio de ésta, sin que nada fallara.
   */
  private acotar<T extends import('typeorm').SelectQueryBuilder<Lead>>(query: T, base: Record<string, unknown>): T {
    query
      .where('lead.organization_id = :organizationId', { organizationId: base.organizationId })
      .andWhere('lead.domain = :domain', { domain: base.domain });
    if (base.clientId) query.andWhere('lead.client_id = :clientId', { clientId: base.clientId });
    return query;
  }

  /** Estados en los que el lead todavía espera algo de alguien. */
  private openStatuses(): LeadStatus[] {
    return Object.values(LeadStatus).filter((s) => !CLOSED_STATUSES.includes(s));
  }

  /**
   * Cuenta y toma un ejemplo en una sola pasada.
   *
   * El ejemplo es el **más antiguo** y no el más reciente: el que lleva más tiempo esperando es el
   * que más urge, y el que más probablemente ya no responda.
   */
  private async alert(key: string, where: Record<string, unknown>): Promise<HomeAlert> {
    const [rows, count] = await this.leads.findAndCount({
      where: where as never,
      order: { createdAt: 'ASC' },
      take: 1,
      select: { id: true, name: true, source: true, campaignName: true, assignedTo: true, createdAt: true },
    });

    const lead = rows[0];
    return {
      key,
      count,
      sample: lead
        ? {
          id: lead.id,
          name: lead.name,
          source: lead.source,
          campaignName: lead.campaignName,
          assignedToName: null,
          createdAt: lead.createdAt,
        }
        : null,
    };
  }

  /**
   * Cuántos lleva cada persona, y en qué estado.
   *
   * Una sola consulta agrupada en vez de una por persona: con quince personas serían cuarenta y
   * cinco consultas para dibujar una tabla que se mira de reojo.
   */
  private async teamLoad(base: Record<string, unknown>, limiteFrio: Date): Promise<TeamLoadRow[]> {
    const filas = await this.acotar(this.leads.createQueryBuilder('lead'), base)
      .select('lead.assigned_to', 'userId')
      .addSelect('COUNT(*)', 'open')
      .addSelect(`SUM(CASE WHEN lead.status = :nuevo THEN 1 ELSE 0 END)`, 'uncontacted')
      .addSelect(`SUM(CASE WHEN lead.updated_at < :limiteFrio THEN 1 ELSE 0 END)`, 'cooling')
      .andWhere('lead.assigned_to IS NOT NULL')
      .andWhere('lead.status NOT IN (:...cerrados)', { cerrados: CLOSED_STATUSES })
      .setParameters({ nuevo: LeadStatus.NEW, limiteFrio })
      .groupBy('lead.assigned_to')
      .getRawMany<{ userId: string; open: string; uncontacted: string; cooling: string }>();

    if (filas.length === 0) return [];

    const personas = await this.users.find({
      where: { id: In(filas.map((f) => f.userId)) },
      select: { id: true, name: true },
    });
    const nombre = new Map(personas.map((p) => [p.id, p.name]));

    return filas
      .map((f) => ({
        userId: f.userId,
        name: nombre.get(f.userId) ?? 'Sin nombre',
        open: Number(f.open),
        uncontacted: Number(f.uncontacted),
        cooling: Number(f.cooling),
      }))
      // De mayor a menor carga: la tabla se lee para saber quién está saturado.
      .sort((a, b) => b.open - a.open);
  }
}
