import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { Contact } from './contact.entity';
import { UpdateContactDto } from './dto/update-contact.dto';

/** Marca un alcance que no puede coincidir con ningún registro. */
const EMPTY_SCOPE = Symbol('empty-client-scope');

interface SegmentCounts {
  total: number;
  frequent: number;
  vip: number;
  inactive90: number;
}

/**
 * Arma la lista de segmentos con sus etiquetas.
 *
 * Los cuatro segmentos se devuelven siempre, incluso en cero: una pantalla que muestra
 * cuatro tarjetas o ninguna según el alcance de quien mira se lee como un error.
 */
function buildSegments(counts: SegmentCounts): Array<{ id: string; label: string; count: number }> {
  return [
    { id: 'total', label: 'Todos los contactos', count: counts.total },
    { id: 'frequent', label: 'Clientes frecuentes (3+ reservas)', count: counts.frequent },
    { id: 'vip', label: 'Clientes VIP (5+ asistencias)', count: counts.vip },
    { id: 'inactive_90d', label: 'No visitan hace 90 días', count: counts.inactive90 },
  ];
}

/** Segmentos de quien no alcanza ninguna cuenta: la pantalla existe, con todo en cero. */
const EMPTY_SEGMENTS = buildSegments({ total: 0, frequent: 0, vip: 0, inactive90: 0 });

/**
 * Lógica de negocio para los contactos de CRM.
 */
@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact) private readonly repo: Repository<Contact>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lista los contactos que la persona puede ver.
   *
   * @param clientId - Acota el listado a la audiencia de una cuenta concreta.
   * @param allowedClientIds - Cuentas que alcanza quien consulta; `undefined` significa sin
   * límite. Un contacto sin cuenta queda fuera para quien está acotado, igual que en leads:
   * si no pertenece a ninguna cuenta asignada, no hay motivo para que lo vea.
   */
  async findAll(
    organizationId: string,
    limit = 50,
    offset = 0,
    clientId?: string,
    allowedClientIds?: string[],
  ): Promise<{ data: Contact[]; total: number; limit: number; offset: number }> {
    const scope = this.clientScope(clientId, allowedClientIds);
    if (scope === EMPTY_SCOPE) return { data: [], total: 0, limit, offset };

    const [data, total] = await this.repo.findAndCount({
      where: scope ? { organizationId, clientId: scope } : { organizationId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  async findOne(id: string, organizationId: string, allowedClientIds?: string[]): Promise<Contact> {
    const contact = await this.repo.findOne({ where: { id, organizationId } });
    if (!contact) throw new NotFoundException('Contact not found');
    if (allowedClientIds !== undefined && (!contact.clientId || !allowedClientIds.includes(contact.clientId))) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  /**
   * Condición de cuenta para una consulta, o `undefined` cuando no hay que acotar.
   *
   * Devuelve `EMPTY_SCOPE` cuando el resultado debe ser vacío. Quien la use debe cortar ahí y
   * no omitir el filtro: omitirlo es exactamente lo que convierte un alcance vacío en acceso
   * a toda la organización.
   */
  private clientScope(clientId?: string, allowedClientIds?: string[]): FindOptionsWhere<Contact>['clientId'] | typeof EMPTY_SCOPE {
    if (allowedClientIds === undefined) return clientId;
    if (allowedClientIds.length === 0) return EMPTY_SCOPE;
    if (clientId) return allowedClientIds.includes(clientId) ? clientId : EMPTY_SCOPE;
    return In(allowedClientIds);
  }

  /**
   * Anota el papel de la persona en la cuenta.
   *
   * Nombre, correo y teléfono no se tocan acá: viven en el lead y se sincronizan desde ahí.
   * Poder editarlos en los dos lados era lo que hacía que los dos registros dijeran cosas
   * distintas de la misma persona.
   */
  async update(id: string, dto: UpdateContactDto, organizationId: string, allowedClientIds?: string[]): Promise<Contact> {
    const contact = await this.findOne(id, organizationId, allowedClientIds);
    if (dto.position !== undefined) contact.position = dto.position.trim() || undefined;
    if (dto.notes !== undefined) contact.notes = dto.notes.trim() || undefined;
    return this.repo.save(contact);
  }

  /**
   * Segmentos de la audiencia, calculados desde reservas reales.
   *
   * Se anclan en `leads` y no en `crm_contacts` porque es la población que la pantalla lista:
   * los dos números salían de tablas distintas y no cuadraban en cuanto un lead de audiencia
   * no tenía contacto derivado, o al revés. El total del encabezado contradecía a la tabla de
   * abajo sin que nada lo explicara.
   *
   * El vínculo con las reservas sigue pasando por el contacto —es donde vive `contact_id`—,
   * así que un lead sin contacto derivado cuenta en el total con cero reservas, que es
   * exactamente lo que es.
   *
   * Solo se ofrecen los segmentos que se pueden calcular con datos que el sistema realmente
   * captura hoy. "Cumpleaños del mes" e "interesados en eventos" quedaron fuera: no existe un
   * campo de fecha de nacimiento ni un sistema de etiquetado de intereses, y no vamos a inventar
   * un número a partir de datos que no tenemos.
   */
  async segments(organizationId: string, clientId?: string, allowedClientIds?: string[]): Promise<Array<{ id: string; label: string; count: number }>> {
    const scope = this.clientScope(clientId, allowedClientIds);
    if (scope === EMPTY_SCOPE) return EMPTY_SEGMENTS;

    // Los ids ya vienen de la base (pods y asignaciones), nunca del llamador, pero igual van
    // como parámetros: una consulta que interpola ids es una que alguien puede copiar mañana
    // a un caso donde sí vengan de fuera.
    const scopedIds = clientId ? [clientId] : allowedClientIds;
    const clientFilter = scopedIds ? `AND l.client_id IN (${scopedIds.map(() => '?').join(',')})` : '';
    const params = scopedIds ? [organizationId, ...scopedIds] : [organizationId];
    // Los conteos se resuelven en la base. Traer una fila por persona para contar cuatro
    // números obligaba a materializar la audiencia entera —decenas de miles de filas en una
    // cuenta con recorrido— y recorrerla tres veces en memoria.
    const [row] = await this.dataSource.query(
      `SELECT
         COUNT(*) total,
         SUM(t.reservations >= 3) frequent,
         SUM(t.attended >= 5) vip,
         SUM(t.last_visit IS NOT NULL AND t.last_visit < DATE_SUB(NOW(), INTERVAL 90 DAY)) inactive90
       FROM (
         SELECT l.id,
                COUNT(r.id) reservations,
                SUM(r.status = 'attended') attended,
                MAX(r.starts_at) last_visit
         FROM leads l
         LEFT JOIN crm_contacts c ON c.lead_id = l.id
         LEFT JOIN reservations r ON r.contact_id = c.id AND r.status NOT LIKE 'cancelled%'
         WHERE l.organization_id = ? AND l.domain = 'audience' ${clientFilter}
         GROUP BY l.id
       ) t`,
      params,
    );
    return buildSegments({
      total: Number(row?.total ?? 0),
      frequent: Number(row?.frequent ?? 0),
      vip: Number(row?.vip ?? 0),
      inactive90: Number(row?.inactive90 ?? 0),
    });
  }

}
