import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Repository } from 'typeorm';
import { Lead } from './lead.entity';
import { LeadStatus } from './lead-status.enum';

/** Una fila de conteo por clave, ya normalizada a número. */
export interface ConteoPorClave { key: string; total: number }

/** Embudo y cuenta sobre los que se piden las cifras. */
export interface Alcance {
  domain?: 'audience' | 'commercial';
  clientId?: string;
  /**
   * Persona a la que se acotan las cifras, cuando su cargo no alcanza el embudo completo.
   *
   * Cuenta lo asignado a ella y lo que no tiene dueño, igual que el listado. Las dos pantallas
   * tienen que contar lo mismo: un total que incluya lo de los demás revela por arriba lo que el
   * tablero oculta por abajo.
   */
  onlyAssignedTo?: string;
  /**
   * Empresas que quien pregunta puede ver. `undefined` es «sin límite»; un arreglo vacío es
   * «ninguna», y no es lo mismo que omitir el filtro.
   */
  allowedClientIds?: string[];
}

/**
 * Comisión que se reconoce sobre lo vendido.
 *
 * Vive acá y no en la pantalla porque la proyección y lo ganado tienen que salir del mismo
 * número: con una copia a cada lado, cambiar el porcentaje en una dejaba la otra mintiendo.
 */
export const TASA_COMISION = 0.02;

/**
 * Cifras del embudo para un período.
 *
 * Todas se calculan sobre `leads` y ninguna sobre un contador acumulado aparte: un contador se
 * desincroniza en cuanto alguien corrige un dato a mano, y entonces el panel y la lista dicen
 * cosas distintas sin que nada falle.
 */
@Injectable()
export class CrmDashboardService {
  constructor(@InjectRepository(Lead) private readonly leads: Repository<Lead>) {}

  /**
   * @param days - Ventana en días. Se acota en el controlador; acá se asume ya validada.
   * @param alcance - Embudo y cuenta que se están mirando, tal como los eligió la barra del CRM.
   *   Sin esto el panel respondía siempre por el embudo de la agencia, así que cambiar de
   *   empresa arriba no cambiaba una sola cifra abajo.
   */
  async dashboard(organizationId: string, days: number, alcance: Alcance = {}) {
    const desde = new Date(Date.now() - days * 86_400_000);
    const domain = alcance.domain ?? 'commercial';
    const base = {
      organizationId,
      domain,
      ...(alcance.clientId
        ? { clientId: alcance.clientId }
        : alcance.allowedClientIds === undefined ? {} : { clientIds: alcance.allowedClientIds }),
      ...(alcance.onlyAssignedTo ? { onlyAssignedTo: alcance.onlyAssignedTo } : {}),
    };

    /*
     * Cuatro de estas cifras se cuentan con un criterio por columnas y no con el constructor de
     * consultas, así que `base` les llega como `where` literal. `onlyAssignedTo` no es una
     * columna —es la persona a la que hay que acotar— y TypeORM respondía error del servidor al
     * no encontrarla: el panel del CRM reventaba con un 500 para cualquiera que no dirija,
     * mientras el resto del módulo funcionaba con normalidad.
     *
     * Se separan: `porColumnas` es lo que entiende un criterio literal, y la persona se aplica
     * como disyunción —lo suyo o lo que está libre—, igual que en el listado y en el inicio.
     */
    const criterio = (extra: Record<string, unknown> = {}) => this.criterio(base, extra);

    const [total, calificados, conVisita, ventas, porEtapa, porFuente, porDia, motivos] = await Promise.all([
      this.leads.count({ where: criterio() as never }),
      this.leads.count({ where: criterio({ status: LeadStatus.QUOTE_SENT }) as never }),
      this.leads.count({ where: criterio({ status: LeadStatus.MEETING_SCHEDULED }) as never }),
      this.leads.count({ where: criterio({ status: LeadStatus.WON }) as never }),
      this.agrupar(base, 'status'),
      this.agrupar(base, 'source'),
      this.porDia(base, desde),
      this.agrupar(base, 'discard_reason', LeadStatus.LOST),
    ]);

    const [montoVendido, pipelineAbierto, estancados] = await Promise.all([
      this.sumar(base, LeadStatus.WON),
      this.sumarAbiertos(base),
      this.leads.count({
        where: criterio({
          status: In([LeadStatus.CONTACTED, LeadStatus.QUOTE_SENT, LeadStatus.NEGOTIATION]),
          updatedAt: LessThan(new Date(Date.now() - 7 * 86_400_000)),
        }) as never,
      }),
    ]);

    const [tiempoDeCierre, conversionPorSetter] = await Promise.all([
      this.tiempoDeCierre(base),
      this.conversionPorSetter(base),
    ]);

    // Quien más convierte, no quien más vende: con volúmenes distintos, el total premia a quien
    // recibió más leads y no a quien los trabaja mejor. Se exige un mínimo de leads para que un
    // 1 de 1 no encabece la lista por encima de un 8 de 20.
    const mejorSetter = conversionPorSetter
      .filter((fila) => fila.leads >= 3)
      .sort((a, b) => b.conversion - a.conversion)[0] ?? null;

    return {
      days,
      domain,
      clientId: alcance.clientId ?? null,
      tiempoDeCierre,
      mejorSetter,
      comision: {
        tasa: TASA_COMISION,
        ganada: Math.round(montoVendido * TASA_COMISION),
        proyectada: Math.round(pipelineAbierto * TASA_COMISION),
      },
      totals: {
        leads: total,
        // Se envía el conteo y no el porcentaje: la pantalla decide cómo redondearlo, y calcular
        // acá obligaría a mandar también el divisor para que pudiera explicarlo.
        calificados,
        conVisita,
        ventas,
        montoVendido,
        pipelineAbierto,
        // El promedio se calcula sobre lo vendido y no sobre todo: incluir los abiertos mezclaría
        // valor cerrado con valor estimado, y el número dejaría de significar nada.
        ticketPromedio: ventas > 0 ? Math.round(montoVendido / ventas) : 0,
        estancados,
      },
      porEtapa,
      porFuente,
      porDia,
      motivosDeCierre: motivos,
    };
  }

  /** Suma el monto estimado de los leads en una etapa. */
  private async sumar(base: Record<string, unknown>, status: LeadStatus): Promise<number> {
    const fila = await this.acotar(this.leads.createQueryBuilder('lead'), base)
      .select('COALESCE(SUM(lead.estimated_amount), 0)', 'total')
      .andWhere('lead.status = :status', { status })
      .getRawOne<{ total: string }>();
    return Number(fila?.total ?? 0);
  }

  /**
   * Días promedio entre que un lead entra y se cierra la venta.
   *
   * `null` cuando todavía no hay ninguna vendida: cero significaría «se cierran el mismo día»,
   * que es una afirmación muy distinta de «no hay con qué calcularlo».
   */
  private async tiempoDeCierre(base: Record<string, unknown>): Promise<number | null> {
    const vendidos = await this.leads.find({
      where: this.criterio(base, { status: LeadStatus.WON }) as never,
      select: { createdAt: true, updatedAt: true } as never,
    });
    if (!vendidos.length) return null;

    const dias = vendidos.map((lead) => {
      const entrada = new Date(lead.createdAt).getTime();
      const cierre = new Date(lead.updatedAt).getTime();
      return Math.max(0, (cierre - entrada) / 86_400_000);
    });
    return Math.round(dias.reduce((suma, valor) => suma + valor, 0) / dias.length);
  }

  /**
   * Conversión de cada responsable: cuántos de sus leads terminaron en venta.
   *
   * Se agrupa en base y no recorriendo la tabla en memoria porque el embudo crece y esta
   * consulta corre cada vez que alguien abre el panel.
   */
  private async conversionPorSetter(
    base: Record<string, unknown>,
  ): Promise<Array<{ assignedTo: string; leads: number; ventas: number; conversion: number }>> {
    const filas = await this.leads.createQueryBuilder('lead')
      .select('lead.assigned_to', 'assignedTo')
      .addSelect('COUNT(*)', 'leads')
      .addSelect(`SUM(CASE WHEN lead.status = '${LeadStatus.WON}' THEN 1 ELSE 0 END)`, 'ventas')
      .where('lead.organization_id = :organizationId', { organizationId: base.organizationId })
      .andWhere('lead.domain = :domain', { domain: base.domain })
      .andWhere(base.clientId ? 'lead.client_id = :clientId' : '1 = 1', { clientId: base.clientId })
      .andWhere('lead.assigned_to IS NOT NULL')
      .groupBy('lead.assigned_to')
      .getRawMany<{ assignedTo: string; leads: string; ventas: string }>();

    return filas.map((fila) => {
      const leads = Number(fila.leads) || 0;
      const ventas = Number(fila.ventas) || 0;
      return { assignedTo: fila.assignedTo, leads, ventas, conversion: leads ? ventas / leads : 0 };
    });
  }

  /**
   * Suma el monto de lo que sigue en juego.
   *
   * Excluye ganado y perdido: uno ya entró y el otro no va a entrar, así que sumarlos al
   * pipeline abierto lo convertiría en un total histórico y no en lo que queda por cerrar.
   */
  private async sumarAbiertos(base: Record<string, unknown>): Promise<number> {
    const fila = await this.acotar(this.leads.createQueryBuilder('lead'), base)
      .select('COALESCE(SUM(lead.estimated_amount), 0)', 'total')
      .andWhere('lead.status NOT IN (:...cerrados)', { cerrados: [LeadStatus.WON, LeadStatus.LOST] })
      .getRawOne<{ total: string }>();
    return Number(fila?.total ?? 0);
  }

  /**
   * Aplica el alcance —organización, embudo y cuenta— a cualquier consulta del panel.
   *
   * Vive en un solo sitio porque son seis consultas: repetirlo dejaba que una se olvidara del
   * filtro y devolviera cifras de otra empresa dentro del panel de esta, sin que nada fallara.
   */
  /**
   * Traduce el alcance a un criterio que entiende una consulta por columnas.
   *
   * `base` lleva la organización, el embudo, la empresa y —cuando corresponde— la persona a la
   * que hay que acotar. Las tres primeras son columnas y se pueden pasar tal cual; la cuarta no
   * lo es, y pasarla revienta la consulta: el panel del CRM respondía error del servidor a
   * cualquiera que no dirija, mientras el resto del módulo funcionaba con normalidad.
   *
   * Acotado a una persona devuelve dos criterios unidos por «o» —lo suyo, o lo que está libre—,
   * la misma regla que aplican el listado y el inicio.
   */
  private criterio(
    base: Record<string, unknown>,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> | Array<Record<string, unknown>> {
    const { onlyAssignedTo, clientIds, ...resto } = base as Record<string, unknown> & {
      onlyAssignedTo?: string;
      clientIds?: string[];
    };
    /*
     * `clientIds` es la lista de empresas alcanzables, no una columna: se traduce a `In(...)`, y
     * vacía a una condición imposible. Sin esta traducción, la consulta o revienta —si se pasa la
     * clave tal cual— o responde por toda la organización —si se omite—, que es lo que hacía.
     */
    const porColumnas = clientIds === undefined
      ? resto
      : { ...resto, clientId: In(clientIds.length ? clientIds : ['']) };

    if (!onlyAssignedTo) return { ...porColumnas, ...extra };
    return [
      { ...porColumnas, ...extra, assignedTo: onlyAssignedTo },
      { ...porColumnas, ...extra, assignedTo: IsNull() },
    ];
  }

  private acotar<T extends import('typeorm').SelectQueryBuilder<Lead>>(query: T, base: Record<string, unknown>): T {
    query
      .where('lead.organization_id = :organizationId', { organizationId: base.organizationId })
      .andWhere('lead.domain = :domain', { domain: base.domain });
    if (base.clientId) query.andWhere('lead.client_id = :clientId', { clientId: base.clientId });
    // Una lista vacía no se omite: se traduce a una condición que no puede cumplirse.
    const alcanzables = base.clientIds as string[] | undefined;
    if (alcanzables !== undefined) {
      query.andWhere(alcanzables.length ? 'lead.client_id IN (:...empresas)' : '1 = 0', { empresas: alcanzables });
    }
    /*
     * Acotado a una persona, el panel cuenta lo suyo y lo que está libre.
     *
     * Es la misma regla del listado, y tiene que serlo: si el panel contara el embudo entero
     * mientras el tablero muestra solo lo propio, las dos pantallas se contradirían y la de
     * arriba estaría revelando el trabajo de los demás en forma de totales.
     */
    if (base.onlyAssignedTo) {
      query.andWhere(
        '(lead.assigned_to = :onlyAssignedTo OR lead.assigned_to IS NULL)',
        { onlyAssignedTo: base.onlyAssignedTo },
      );
    }
    return query;
  }

  /**
   * Cuenta leads agrupados por una columna.
   *
   * El nombre de columna no viene de fuera: son tres valores fijos escritos acá. Interpolar uno
   * recibido por la API sería inyección de SQL, y `createQueryBuilder` no parametriza nombres de
   * columna, solo valores.
   */
  private async agrupar(base: Record<string, unknown>, columna: 'status' | 'source' | 'discard_reason', status?: LeadStatus) {
    const query = this.acotar(this.leads.createQueryBuilder('lead'), base)
      .select(`lead.${columna}`, 'key')
      .addSelect('COUNT(*)', 'total')
      .groupBy(`lead.${columna}`);

    if (status) query.andWhere('lead.status = :status', { status });

    const filas = await query.getRawMany<{ key: string | null; total: string }>();
    return filas
      .filter((fila) => fila.key)
      .map((fila) => ({ key: fila.key!, total: Number(fila.total) }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Leads por día dentro de la ventana.
   *
   * Devuelve solo los días con al menos uno. Rellenar los vacíos es trabajo de la pantalla, que
   * es la que sabe cuántos puntos caben en el ancho disponible.
   */
  private async porDia(base: Record<string, unknown>, desde: Date): Promise<ConteoPorClave[]> {
    const filas = await this.acotar(this.leads.createQueryBuilder('lead'), base)
      .select('DATE(lead.created_at)', 'key')
      .addSelect('COUNT(*)', 'total')
      .andWhere('lead.created_at >= :desde', { desde })
      .groupBy('DATE(lead.created_at)')
      .orderBy('DATE(lead.created_at)', 'ASC')
      .getRawMany<{ key: string; total: string }>();

    return filas.map((fila) => ({ key: String(fila.key), total: Number(fila.total) }));
  }
}
