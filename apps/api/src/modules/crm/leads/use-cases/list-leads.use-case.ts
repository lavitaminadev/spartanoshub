import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Like, Repository } from 'typeorm';
import { Lead } from '../lead.entity';
import { RESERVATION_LEAD_SOURCES, isReservationLeadSource } from '@espartanos/shared';

/** Filtros aceptados al listar leads. */
export interface ListLeadsFilters {
  status?: string;
  fitStatus?: string;
  source?: string;
  search?: string;
  assignedTo?: string;
  /**
   * Embudo a listar. A diferencia de `source` (opcional, de mayor detalle), este filtro
   * tiene un valor por defecto obligatorio en `execute()`: sin él, una consulta sin
   * parámetros mezclaría prospectos comerciales de la agencia con comensales que
   * reservaron, que es exactamente el riesgo que `leads.domain` (migración 0069) existe
   * para evitar. Pasa `'all'` explícitamente si de verdad se necesitan ambos dominios juntos.
   */
  domain?: 'audience' | 'commercial' | 'all';
  /** Cliente concreto solicitado por quien consulta. */
  clientId?: string;
  /**
   * Embudo propio de la agencia: solo registros que todavía no pertenecen a una empresa.
   *
   * No se representa dejando `clientId` vacío porque, para una consulta administrativa, vacío
   * significaba históricamente "sin filtro" y terminaba incluyendo también los CRM de clientes.
   */
  agencyOnly?: boolean;
  /**
   * Cuentas que el usuario tiene permitido ver.
   *
   * `undefined` habilita toda la organización. Un arreglo vacío no devuelve resultados,
   * que es el comportamiento esperado para un usuario sin cuentas asignadas.
   */
  allowedClientIds?: string[];
  /**
   * Persona a la que se acota el listado, dentro de las cuentas ya permitidas.
   *
   * Devuelve lo asignado a ella **más lo que no tiene dueño**: sin esto último, los leads nuevos
   * solo los vería quien ya ve todo, que es justo quien no los va a trabajar.
   *
   * `undefined` no acota. Es una reja distinta de `allowedClientIds`: aquélla decide a qué
   * empresas se entra, ésta cuánto se ve dentro de cada una.
   */
  onlyAssignedTo?: string;
}

/** Página de leads acompañada del total de coincidencias. */
export interface ListLeadsResult {
  data: Lead[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class ListLeadsUseCase {
  constructor(
    @InjectRepository(Lead) private repo: Repository<Lead>,
  ) {}

  /**
   * Lista los leads de una organización, del más reciente al más antiguo.
   *
   * @param organizationId - Organización a la que pertenecen los leads.
   * @param limit - Tamaño de página.
   * @param offset - Registros a saltar.
   * @param filters - Filtros opcionales y alcance de cuentas permitido.
   * @returns Página de leads y el total que cumple los filtros.
   */
  async execute(
    organizationId: string,
    limit = 20,
    offset = 0,
    filters: ListLeadsFilters = {},
  ): Promise<ListLeadsResult> {
    const where: FindOptionsWhere<Lead> = { organizationId } as FindOptionsWhere<Lead>;
    if (filters.status) where.status = filters.status as Lead['status'];
    if (filters.fitStatus) where.fitStatus = filters.fitStatus as Lead['fitStatus'];
    if (filters.source) where.source = expandSourceFilter(filters.source);
    if (filters.assignedTo) where.assignedTo = filters.assignedTo;
    const domain = filters.domain ?? 'commercial';
    if (domain !== 'all') where.domain = domain;

    const scope = this.resolveClientScope(filters);
    if (scope === EMPTY_SCOPE) return { data: [], total: 0, limit, offset };
    if (scope !== undefined) where.clientId = scope;

    /*
     * Acotar por persona obliga a dos criterios unidos por «o» —lo suyo, o lo que está libre—, y
     * en TypeORM eso es un arreglo de condiciones completas. Se repite `where` entero en ambas:
     * dejar fuera una condición en una de las dos ramas abriría por ahí lo que la otra cierra.
     */
    const alcancePersona: FindOptionsWhere<Lead>[] = filters.onlyAssignedTo
      ? [
        { ...where, assignedTo: filters.onlyAssignedTo },
        { ...where, assignedTo: IsNull() },
      ]
      : [where];

    const termino = filters.search?.trim();
    const campos: Array<keyof Pick<Lead, 'name' | 'email' | 'phone' | 'company' | 'source' | 'sourceDetail' | 'campaignName'>> = [
      'name', 'email', 'phone', 'company', 'source', 'sourceDetail', 'campaignName',
    ];
    const criterio: FindOptionsWhere<Lead> | FindOptionsWhere<Lead>[] = termino
      ? alcancePersona.flatMap((base) => campos.map((campo) => ({ ...base, [campo]: Like(`%${termino}%`) })))
      : alcancePersona.length === 1 ? alcancePersona[0] : alcancePersona;

    const [data, total] = await this.repo.findAndCount({
      where: criterio,
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
    return { data, total, limit, offset };
  }

  /**
   * Combina el cliente solicitado con las cuentas permitidas.
   *
   * @returns Criterio a aplicar sobre `clientId`, `undefined` para no filtrar, o
   *   `EMPTY_SCOPE` cuando la combinación no puede devolver resultados.
   */
  private resolveClientScope(filters: ListLeadsFilters): FindOptionsWhere<Lead>['clientId'] | typeof EMPTY_SCOPE {
    const { clientId, allowedClientIds, agencyOnly } = filters;
    // Esta vista solo existe para usuarios sin recorte de cuentas. Una persona acotada nunca
    // obtiene el embudo de la agencia por omitir `clientId`.
    if (agencyOnly) return allowedClientIds === undefined ? IsNull() : EMPTY_SCOPE;
    if (allowedClientIds === undefined) return clientId;
    if (allowedClientIds.length === 0) return EMPTY_SCOPE;
    if (clientId) return allowedClientIds.includes(clientId) ? clientId : EMPTY_SCOPE;
    return In(allowedClientIds);
  }
}

/** Marca un alcance que no puede coincidir con ningún registro. */
const EMPTY_SCOPE = Symbol('empty-client-scope');

/**
 * Traduce el origen pedido al criterio que debe aplicarse sobre la columna.
 *
 * Pedir el origen de reservas devuelve también las filas guardadas con el nombre anterior, de
 * modo que el listado es correcto tanto antes como después de que corra la migración que las
 * reescribe, y durante un despliegue en el que ambas versiones convivan.
 */
function expandSourceFilter(source: string): FindOptionsWhere<Lead>['source'] {
  return isReservationLeadSource(source) ? In([...RESERVATION_LEAD_SOURCES]) : source;
}
