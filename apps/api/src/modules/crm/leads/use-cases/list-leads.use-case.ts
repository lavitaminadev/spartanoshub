import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, In, IsNull, LessThanOrEqual, MoreThanOrEqual, Raw, Repository } from 'typeorm';
import { Lead } from '../lead.entity';
import { RESERVATION_LEAD_SOURCES, isReservationLeadSource } from '@espartanos/shared';

/** Filtros aceptados al listar leads. */
export interface ListLeadsFilters {
  /** Clave de un campo propio (ya validada) y el valor que debe tener. */
  anuncio?: string;
  plataforma?: string;
  campoPropio?: string;
  valorPropio?: string;
  status?: string;
  fitStatus?: string;
  source?: string;
  /** Campaña exacta. Acota «cuántos trajo esta campaña», que la búsqueda de texto no responde. */
  campaignName?: string;
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
  /**
   * Traer también los descartados de meses ya cerrados.
   *
   * Un descartado no espera nada de nadie, y es lo que más se acumula: dejarlos en la lista
   * entierra lo que sí hay que trabajar. Se van de la vista al cerrar el mes, no de la base —el
   * descartado es el denominador de toda medición, y sin él una campaña que trae basura parece
   * traer pocos leads excelentes.
   *
   * Filtrar por la etapa «Descartado» los muestra todos igualmente: pedirlos explícitamente ya
   * es decir que se quieren ver.
   */
  incluirDescartados?: boolean;
  /** Período de ingreso, `AAAA-MM-DD`. Acota por cuándo entró el lead. */
  desde?: string;
  hasta?: string;
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
  /**
   * Cuántos días sigue a la vista un prospecto **cerrado**.
   *
   * Era hasta el día 1 del mes en curso, y ese corte castigaba por casualidad: uno cerrado el 31
   * desaparecía al día siguiente y otro cerrado el 2 duraba un mes entero. Nadie trabaja pensando
   * «este mes»; se piensa «lo de las últimas semanas», y treinta días es eso.
   *
   * No esconde nada: con la casilla de ver también los cerrados antiguos, filtrando por su etapa,
   * o pidiendo un período, siguen apareciendo todos sin límite de fecha.
   */
  private static readonly DIAS_DE_CERRADOS_A_LA_VISTA = 30;

  /**
   * Etapas que sacan al prospecto del trabajo del día.
   *
   * Sólo las dos de desenlace. Un lead en cualquier otra etapa —aunque lleve meses— sigue abierto
   * y tiene que verse siempre: desaparecer por antigüedad haría que una ficha viva se leyera como
   * perdida, que es exactamente lo contrario de lo que el tablero tiene que mostrar.
   */
  private static readonly CERRADAS = ['lost', 'won'] as const;

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
    // La entidad recorta la campaña al guardarla, así que comparar el valor tal cual basta y no
    // hace falta normalizar acá.
    if (filters.campaignName) where.campaignName = filters.campaignName;
    /*
     * `sin` es la bandeja de lo que nadie ha tomado.
     *
     * Va antes del caso normal porque no es un identificador: tratarlo como tal buscaría un
     * responsable llamado «sin» y devolvería siempre cero.
     */
    if (filters.assignedTo === 'sin') where.assignedTo = IsNull();
    else if (filters.assignedTo) where.assignedTo = filters.assignedTo;
    const domain = filters.domain ?? 'commercial';
    if (domain !== 'all') where.domain = domain;
    /*
     * De qué anuncio y de qué plataforma vino.
     *
     * Viven en los datos de la captura y no en columnas propias: una campaña trae por Instagram
     * y por Facebook a la vez, y saber cuál rinde exigía abrir los leads de a uno.
     */
    const deLaCaptura: string[] = [];
    const valoresDeLaCaptura: Record<string, string> = {};
    if (filters.anuncio) {
      deLaCaptura.push("JSON_UNQUOTE(JSON_EXTRACT({columna}, '$.adName')) LIKE :anuncio");
      valoresDeLaCaptura.anuncio = `%${filters.anuncio}%`;
    }
    if (filters.plataforma) {
      deLaCaptura.push("JSON_UNQUOTE(JSON_EXTRACT({columna}, '$.platform')) = :plataforma");
      valoresDeLaCaptura.plataforma = filters.plataforma;
    }
    if (deLaCaptura.length > 0) {
      (where as Record<string, unknown>).metadata = Raw(
        (columna) => deLaCaptura.map((condicion) => condicion.replace('{columna}', columna)).join(' AND '),
        valoresDeLaCaptura,
      );
    }
    if (filters.campoPropio && filters.valorPropio !== undefined && /^[a-z][a-z0-9_]{0,39}$/.test(filters.campoPropio)) {
      const ruta = `$."${filters.campoPropio}"`;
      // Igual para texto, número, fecha y sí/no; contenido para una selección múltiple.
      (where as Record<string, unknown>).customFields = Raw((columna) => `(JSON_UNQUOTE(JSON_EXTRACT(${columna}, :rutaPropia)) = :valorPropio OR JSON_CONTAINS(JSON_EXTRACT(${columna}, :rutaPropia), JSON_QUOTE(:valorPropio)))`, { rutaPropia: ruta, valorPropio: filters.valorPropio });
    }

    const scope = this.resolveClientScope(filters);
    if (scope === EMPTY_SCOPE) return { data: [], total: 0, limit, offset };
    if (scope !== undefined) where.clientId = scope;

    /*
     * Acotar por persona es un «o» —lo suyo, o lo que está libre— que vive **dentro** de un solo
     * paréntesis, sobre la única columna que la disyunción toca.
     *
     * Garantiza por construcción lo que antes había que vigilar: al no haber más de una rama del
     * `where`, no existe una donde olvidar una condición que la otra sí aplica, así que ninguna
     * reja —`organizationId`, `clientId`, `domain`— puede quedar abierta por un lado.
     */
    if (filters.onlyAssignedTo) {
      (where as Record<string, unknown>).assignedTo = Raw(
        (columna) => `(${columna} = :suyo OR ${columna} IS NULL)`,
        { suyo: filters.onlyAssignedTo },
      );
    }

    /*
     * El período de ingreso, cuando se pide.
     *
     * Acota por `createdAt`: la pregunta es «qué trajo septiembre», y la fecha de entrada es la
     * única que no se mueve después. `hasta` cubre el día entero —quien escribe el 30 espera ver
     * lo del 30—, así que se lleva al final de esa jornada.
     */
    const periodo: Record<string, unknown> = {};
    if (filters.desde && filters.hasta) {
      periodo.createdAt = Between(new Date(`${filters.desde}T00:00:00`), new Date(`${filters.hasta}T23:59:59.999`));
    } else if (filters.desde) {
      periodo.createdAt = MoreThanOrEqual(new Date(`${filters.desde}T00:00:00`));
    } else if (filters.hasta) {
      periodo.createdAt = LessThanOrEqual(new Date(`${filters.hasta}T23:59:59.999`));
    }
    Object.assign(where, periodo);

    /*
     * Los cerrados viejos salen de la vista, salvo que se pidan.
     *
     * **Sólo alcanza a vendidos y descartados.** Un lead en cualquier otra etapa se ve siempre,
     * sin límite de fecha: el corte no es «leads viejos», es «cerrados que ya no hay que mirar».
     * Si alcanzara a los abiertos, una ficha viva desaparecería por antigüedad y se leería como
     * perdida.
     *
     * Se mira `updatedAt` y no `createdAt`: interesa cuándo se cerró, no cuándo entró.
     *
     * **Tres cosas lo desactivan**, y las tres son la persona diciendo qué quiere ver: pedir los
     * cerrados con la casilla, filtrar por una etapa, o acotar un período. Recortar además por
     * antigüedad dentro de un período elegido a mano devolvería menos de lo pedido sin explicar
     * por qué.
     *
     * La disyunción —«no está cerrado, o se cerró hace poco»— va agrupada en un paréntesis dentro
     * del mismo `where`, no como criterios alternativos al `where` completo. Lo segundo obligaría
     * a repetir todas las demás condiciones en cada rama, y el motor no puede usar índice contra
     * esa forma: pasa a recorrer la tabla entera y a reevaluar cada condición una vez por rama.
     */
    if (!filters.incluirDescartados && !filters.status && !Object.keys(periodo).length) {
      const limite = new Date(Date.now() - ListLeadsUseCase.DIAS_DE_CERRADOS_A_LA_VISTA * 86_400_000);
      const cerradas = [...ListLeadsUseCase.CERRADAS];
      const columnaCierre = this.columna('updatedAt');
      (where as Record<string, unknown>).status = Raw(
        (columna) => `(${columna} NOT IN (:...cerradas) OR ${columnaCierre} >= :limite)`,
        { cerradas, limite },
      );
    }

    /*
     * La búsqueda libre, en un solo paréntesis sobre los siete campos.
     *
     * Los nombres de columna se resuelven desde los metadatos de la entidad y no se escriben a
     * mano: renombrar una propiedad de `Lead` rompe la compilación, y renombrar su columna en la
     * base queda cubierto sin tocar esta consulta.
     */
    const termino = filters.search?.trim();
    const campos: Array<keyof Pick<Lead, 'name' | 'email' | 'phone' | 'company' | 'source' | 'sourceDetail' | 'campaignName'>> = [
      'name', 'email', 'phone', 'company', 'source', 'sourceDetail', 'campaignName',
    ];
    if (termino) {
      const condiciones = campos.map((campo) => `${this.columna(campo)} LIKE :termino`).join(' OR ');
      (where as Record<string, unknown>).name = Raw(() => `(${condiciones})`, { termino: `%${termino}%` });
    }

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
    return { data: data.map((lead) => this.aligerar(lead)), total, limit, offset };
  }

  /**
   * Nombre con que una propiedad de `Lead` se escribe dentro de una condición `Raw`.
   *
   * Devuelve la columna calificada con el alias de la consulta —`` `Lead`.`updated_at` ``—, no el
   * nombre suelto: una condición `Raw` que menciona otra columna que la suya quedaría ambigua el
   * día que esta consulta lleve un `join`, y el fallo sería en ejecución y no en compilación.
   *
   * La traducción sale de los metadatos de la entidad, de modo que el SQL en texto no fija ningún
   * nombre de columna por su cuenta.
   */
  private columna(propiedad: keyof Lead): string {
    const { driver } = this.repo.manager.connection;
    const columna = this.repo.metadata.findColumnWithPropertyName(propiedad as string);
    if (!columna) throw new Error(`La entidad Lead no declara la propiedad «${String(propiedad)}»`);
    return `${driver.escape(this.repo.metadata.name)}.${driver.escape(columna.databaseName)}`;
  }

  /**
   * Quita de la respuesta lo que el listado no muestra.
   *
   * La metadata de un lead guarda todas las respuestas de su formulario. El tablero pinta cuatro
   * datos por tarjeta y nunca abre esa lista —para leerla se abre la ficha, que pide el lead
   * entero—, así que con cien leads de un formulario de seis preguntas viajaban al navegador
   * cientos de respuestas que nadie iba a mirar. Es lo que hace que un tablero de ochenta y ocho
   * leads tarde en abrir.
   *
   * Se conservan las dos claves que el tablero sí usa: el nombre del anuncio y la plataforma
   * alimentan sus filtros. Quitarlas dejaría esos filtros vacíos sin que nada fallara.
   */
  private aligerar(lead: Lead): Lead {
    const metadata = lead.metadata as { adName?: unknown; platform?: unknown } | null | undefined;
    if (!metadata || typeof metadata !== 'object') return lead;

    const resumen: Record<string, unknown> = {};
    if (metadata.adName !== undefined) resumen.adName = metadata.adName;
    if (metadata.platform !== undefined) resumen.platform = metadata.platform;
    return Object.assign(lead, { metadata: resumen });
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
