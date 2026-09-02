import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Repository, LessThan } from 'typeorm';
import { Lead } from './lead.entity';
import { LeadStatus } from './lead-status.enum';
import { CLAVE_AVISO, PLAZOS_POR_DEFECTO } from './inactividad-del-lead';
import { ParameterResolver } from '../../../core/parameters/parameter-resolver.service';
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

/**
 * Un aviso del inicio: cuántos son, y quiénes.
 *
 * Trae los primeros —los que llevan más tiempo esperando— y no solo el total. Un número manda a
 * buscar a otra pantalla; una lista de nombres se puede empezar a trabajar sin salir del inicio.
 * El resto queda contado en `count`, que es siempre el total y no lo que cabe en la lista.
 */
export interface HomeAlert {
  key: string;
  count: number;
  /** Qué tan urgente es. Decide el color del aviso, no su orden. */
  level: 'critico' | 'alto';
  items: HomeLeadPreview[];
  /** El primero de `items`. Se mantiene para que nada que lo lea deje de funcionar. */
  sample: HomeLeadPreview | null;
}

/** Cuántos nombres muestra cada aviso antes de resumir el resto en «y N más». */
const MUESTRA_POR_AVISO = 5;

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
    private readonly parametros: ParameterResolver,
  ) {}

  /**
   * @param coolingDays - Días sin movimiento tras los que un lead se considera enfriándose.
   *   Es configuración y no una constante porque el plazo razonable depende del negocio: en una
   *   venta de departamentos no es el mismo que en una consulta de agenda.
   * @param alcance - Empresa cuyo CRM se está mirando, tal como la eligió la barra. Sin esto el
   *   inicio respondía siempre por toda la organización, así que cambiar de empresa arriba
   *   dejaba los avisos y la carga del equipo mostrando lo de antes.
   */
  async home(
    organizationId: string,
    coolingDays = 7,
    alcance: {
      domain?: 'audience' | 'commercial';
      clientId?: string;
      agencyOnly?: boolean;
      onlyAssignedTo?: string;
      /**
       * Empresas que quien pregunta puede ver. `undefined` es «sin límite»; un arreglo vacío es
       * «ninguna», y **no** es lo mismo que omitir el filtro: confundirlos es exactamente cómo un
       * alcance vacío se convierte en acceso total.
       */
      allowedClientIds?: string[];
      /**
       * Ocultar el reparto interno de la agencia.
       *
       * La carga del equipo dice qué persona de Espartanos lleva cada lead. Para la empresa
       * cliente eso no es información suya: es cómo se organiza su proveedor. Se omitía solo
       * para los cargos acotados —y el cliente no lo es—, así que la veía entera con nombres.
       */
      ocultarEquipo?: boolean;
    } = {},
  ) {
    const inicioDeMes = new Date();
    inicioDeMes.setDate(1);
    inicioDeMes.setHours(0, 0, 0, 0);

    const limiteFrio = new Date(Date.now() - coolingDays * 86_400_000);
    /*
     * Desde cuándo un lead cuenta como parado.
     *
     * El plazo es un ajuste de la organización porque el ritmo depende del negocio. Se resuelve
     * una vez para toda la pantalla: preguntarlo por lead sería una consulta por tarjeta.
     */
    const diasParaParado = Number(
      await this.parametros.get(CLAVE_AVISO, null, null, organizationId) ?? PLAZOS_POR_DEFECTO.notice,
    );
    const limiteParado = new Date(Date.now() - diasParaParado * 86_400_000);
    // Se compone una vez y se reparte: con seis consultas, repetir el filtro dejaba que alguna
    // se olvidara y contara leads de otra empresa dentro del inicio de ésta.
    const base = {
      organizationId,
      domain: alcance.domain ?? 'commercial',
      ...this.alcanceDeCuentas(alcance),
    };
    const abierto = { ...base, status: In(this.openStatuses()) };

    const [delMes, ventasDelMes, montoDelMes, sinContactar, sinAsignar, calificadosSinVisita, parados, equipo, recentLeads] = await Promise.all([
      // Las cifras del mes cuentan lo mismo que muestran los avisos y el tablero. Si contaran el
      // embudo entero, el encabezado estaría diciendo por arriba lo que el filtro oculta abajo.
      this.leads.count({ where: this.soloLoSuyo({ ...base, createdAt: MoreThanOrEqual(inicioDeMes) }, alcance.onlyAssignedTo) as never }),
      this.leads.count({ where: this.soloLoSuyo({ ...base, status: LeadStatus.WON, updatedAt: MoreThanOrEqual(inicioDeMes) }, alcance.onlyAssignedTo) as never }),
      this.montoDelMes({ ...base, onlyAssignedTo: alcance.onlyAssignedTo }, inicioDeMes),
      this.alert('sin_contactar', 'critico', this.soloLoSuyo({ ...abierto, status: LeadStatus.NEW }, alcance.onlyAssignedTo)),
      /*
       * Lo que no tiene dueño lo ve todo el mundo, también quien está acotado a lo suyo.
       *
       * Es el único aviso que no se filtra por persona, y a propósito: ocultarlo dejaría los
       * leads nuevos esperando a que los tome alguien que, por su cargo, no los va a trabajar.
       */
      // Pasa por `paraCriterio` igual que los demás: no se filtra por persona, pero sí por las
      // empresas alcanzables. Un lead sin dueño de una cuenta ajena tampoco es asunto de nadie.
      this.alert('sin_asignar', 'critico', this.paraCriterio({ ...abierto, assignedTo: IsNull() })),
      /*
       * Calificado y todavía sin visita agendada.
       *
       * Basta con mirar la etapa: el embudo es secuencial y agendar la visita mueve el lead a la
       * siguiente. Comprobar además que no exista una visita sería preguntar dos veces lo mismo,
       * y cualquier discrepancia entre ambas respuestas dejaría el aviso mintiendo.
       */
      this.alert('calificados_sin_visita', 'alto', this.soloLoSuyo({
        ...base,
        status: LeadStatus.QUOTE_SENT,
      }, alcance.onlyAssignedTo)),
      /*
       * La carga del equipo solo la ve quien reparte trabajo.
       *
       * A quien está acotado a lo suyo se le devuelve vacía y la pantalla no dibuja la tabla:
       * mostrarla con una sola fila —la propia— haría creer que el equipo es una persona, y
       * mostrarla completa sería enseñar por otra vía justo lo que el filtro oculta.
       */
      /*
       * Leads que llevan días sin cambiar de etapa.
       *
       * Es el mismo hecho que marca la tarjeta en el tablero, y estaba solo ahí: quien entra por
       * el inicio para saber qué atender no lo veía, que es justo la pantalla donde se decide.
       *
       * Basta el primer umbral para contar. Los tres niveles sirven para pintar una tarjeta, no
       * para decidir si algo entra en un aviso: partir el aviso en tres daría tres números que
       * suman lo mismo y obligan a sumarlos con la vista.
       *
       * Se compara la fecha en la consulta y no en memoria: acá se cuentan todos los leads
       * abiertos de la empresa, y traerlos para descartarlos sería leer la tabla entera.
       */
      this.alert('parados', 'alto', this.soloLoSuyo({
        ...abierto,
        stageChangedAt: LessThan(limiteParado),
      }, alcance.onlyAssignedTo)),
      alcance.onlyAssignedTo || alcance.ocultarEquipo
        ? Promise.resolve([])
        : this.teamLoad(base, limiteFrio),
      this.leads.find({
        where: this.soloLoSuyo(base, alcance.onlyAssignedTo) as never,
        order: { createdAt: 'DESC' },
        take: 8,
        select: { id: true, name: true, source: true, campaignName: true, createdAt: true },
      }),
    ]);

    const alerts = [sinContactar, sinAsignar, calificadosSinVisita, parados].filter((a) => a.count > 0);

    return {
      month: { leads: delMes, ventas: ventasDelMes, monto: montoDelMes },
      // La pantalla lo dice en una línea: sin avisarlo, un embudo acotado se lee como uno vacío.
      personalScope: Boolean(alcance.onlyAssignedTo),
      /*
       * Cuántos leads urgen, no cuántos avisos hay.
       *
       * El saludo dice «tienes N asuntos urgentes»: si contara los avisos, tres leads sin
       * contactar y treinta darían el mismo «1». Solo suma los críticos —lo que nadie está
       * mirando—; un calificado sin visita ya tiene dueño y puede esperar al final del día.
       */
      urgentCount: alerts
        .filter((a) => a.level === 'critico')
        .reduce((suma, a) => suma + a.count, 0),
      alerts,
      team: equipo,
      recentLeads,
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
    if (base.agencyOnly) query.andWhere('lead.client_id IS NULL');
    else if (base.clientId) query.andWhere('lead.client_id = :clientId', { clientId: base.clientId });
    // Una lista vacía no se omite: se traduce a una condición que no puede cumplirse.
    const alcanzables = base.clientIds as string[] | undefined;
    if (alcanzables !== undefined) {
      query.andWhere(alcanzables.length ? 'lead.client_id IN (:...empresas)' : '1 = 0', { empresas: alcanzables });
    }
    // Lo suyo o lo que está libre, la misma regla que aplican los avisos y el listado.
    if (base.onlyAssignedTo) {
      query.andWhere(
        '(lead.assigned_to = :onlyAssignedTo OR lead.assigned_to IS NULL)',
        { onlyAssignedTo: base.onlyAssignedTo },
      );
    }
    return query;
  }

  /**
   * Traduce la empresa pedida y las alcanzables a una condición sobre `client_id`.
   *
   * Sin esto, el inicio respondía por **toda la organización** cuando no se pedía ninguna empresa:
   * el control comprobaba la empresa solicitada, y sin solicitud no comprobaba nada. Con el portal
   * del cliente entrando al CRM, eso significaba que una empresa veía las cifras y los nombres de
   * las demás sin adivinar nada, solo omitiendo un parámetro.
   */
  private alcanceDeCuentas(
    alcance: { clientId?: string; allowedClientIds?: string[]; agencyOnly?: boolean },
  ): Record<string, unknown> {
    if (alcance.agencyOnly) return { agencyOnly: true };
    // Una empresa concreta: el controlador ya comprobó que quien pregunta la alcanza.
    if (alcance.clientId) return { clientId: alcance.clientId };
    // Sin límite de cuentas: administración y direcciones.
    if (alcance.allowedClientIds === undefined) return {};
    /*
     * Ninguna cuenta alcanzable es una condición imposible, no la ausencia de condición. Se
     * guarda como lista y no como criterio de TypeORM porque `base` viaja a dos sitios que la
     * entienden distinto: un `where` por columnas y el constructor de consultas.
     */
    return { clientIds: alcance.allowedClientIds };
  }

  /** Estados en los que el lead todavía espera algo de alguien. */
  private openStatuses(): LeadStatus[] {
    return Object.values(LeadStatus).filter((s) => !CLOSED_STATUSES.includes(s));
  }

  /**
   * Acota un criterio a lo de una persona, más lo que no tiene dueño.
   *
   * Devuelve un arreglo porque es una disyunción, y en TypeORM eso son dos condiciones completas.
   * Sin persona devuelve el criterio tal cual, para que quien ve todo no pague nada.
   */
  private soloLoSuyo(
    where: Record<string, unknown>,
    usuarioId?: string,
  ): Record<string, unknown> | Array<Record<string, unknown>> {
    const porColumnas = this.paraCriterio(where);
    if (!usuarioId) return porColumnas;
    return [
      { ...porColumnas, assignedTo: usuarioId },
      { ...porColumnas, assignedTo: IsNull() },
    ];
  }

  /**
   * Deja el criterio en la forma que entiende un `where` por columnas.
   *
   * `clientIds` es la lista de empresas alcanzables y no una columna: se traduce a `In(...)`, y
   * vacía a una condición imposible. Pasarla tal cual haría que TypeORM no encontrara la columna
   * y la consulta reventara.
   */
  private paraCriterio(where: Record<string, unknown>): Record<string, unknown> {
    const { clientIds, agencyOnly, ...resto } = where as Record<string, unknown> & {
      clientIds?: string[];
      agencyOnly?: boolean;
    };
    if (agencyOnly) return { ...resto, clientId: IsNull() };
    if (clientIds === undefined) return resto;
    return { ...resto, clientId: In(clientIds.length ? clientIds : ['']) };
  }

  /**
   * Cuenta y toma los primeros en una sola pasada.
   *
   * Se ordenan del **más antiguo** al más reciente: el que lleva más tiempo esperando es el que
   * más urge, y el que más probablemente ya no responda.
   *
   * @param nivel - Urgencia con que se pinta el aviso. Sin asignar y sin contactar son críticos
   *   porque nadie los está mirando; un calificado sin visita ya tiene dueño.
   */
  private async alert(
    key: string,
    nivel: HomeAlert['level'],
    where: Record<string, unknown> | Array<Record<string, unknown>>,
  ): Promise<HomeAlert> {
    const [rows, count] = await this.leads.findAndCount({
      where: where as never,
      order: { createdAt: 'ASC' },
      take: MUESTRA_POR_AVISO,
      select: { id: true, name: true, source: true, campaignName: true, assignedTo: true, createdAt: true },
    });

    const items: HomeLeadPreview[] = rows.map((lead) => ({
      id: lead.id,
      name: lead.name,
      source: lead.source,
      campaignName: lead.campaignName,
      assignedToName: null,
      createdAt: lead.createdAt,
    }));

    return { key, count, level: nivel, items, sample: items[0] ?? null };
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
