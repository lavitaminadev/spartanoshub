import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { WorkRequest, WorkRequestArea, WorkRequestStatus } from './work-request.entity';
import { Client } from '../clients/client.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { Piece } from '../production/piece.entity';
import { Session } from '../audiovisual/session.entity';
import { PieceStatus } from '../production/piece-status.enum';
import { UdValuesService } from '../design-budget/ud-values.service';
import { PieceTypesService } from '../production/piece-types.service';
import { CreateWorkRequestDto, ResolveWorkRequestDto, UpdateWorkRequestDto } from './dto/work-request.dto';
import { UserRole } from '../organizations/user-role.enum';
import { retryOnDeadlock } from '../../shared/retry-on-deadlock';

/** Marca un alcance que no puede coincidir con ningún registro. */
const EMPTY_SCOPE = Symbol('empty-client-scope');

/**
 * Transiciones permitidas.
 *
 * `converted` y `rejected` son terminales: una solicitud no se reabre, se crea otra. Reabrir
 * borra el tiempo que ya midió y esos tiempos son el insumo de los SLA.
 */
/**
 * Quién ejecuta el trabajo de cada área.
 *
 * Incluye a la dirección del área porque también produce, no solo coordina. No incluye a
 * Operaciones: asigna el trabajo, no lo hace.
 */
const ROLES_BY_AREA: Record<WorkRequestArea, UserRole[]> = {
  [WorkRequestArea.DESIGN]: [UserRole.DESIGNER, UserRole.ART_DIRECTOR],
  [WorkRequestArea.AUDIOVISUAL]: [UserRole.AUDIOVISUAL, UserRole.AV_DIRECTOR],
  [WorkRequestArea.COMMUNITY]: [UserRole.COMMUNITY_MANAGER],
};

/**
 * Áreas que alcanza cada cargo en la bandeja.
 *
 * El plan lo fija así: **cada área ve lo suyo, dirección ve todo**. Las direcciones de arte y
 * audiovisual quedan acotadas a su propia área porque dirigirla no implica necesitar el
 * trabajo de las otras, y acotarlo limita lo que queda expuesto si una sesión se compromete.
 *
 * Un cargo que no aparece acá no ve nada por área; sigue viendo lo que pidió y lo que tiene
 * asignado, que es la salvedad de `visibleAreas`.
 */
const AREAS_BY_ROLE: Partial<Record<UserRole, WorkRequestArea[]>> = {
  [UserRole.DESIGNER]: [WorkRequestArea.DESIGN],
  [UserRole.ART_DIRECTOR]: [WorkRequestArea.DESIGN],
  [UserRole.AUDIOVISUAL]: [WorkRequestArea.AUDIOVISUAL],
  [UserRole.AV_DIRECTOR]: [WorkRequestArea.AUDIOVISUAL],
  [UserRole.COMMUNITY_MANAGER]: [WorkRequestArea.COMMUNITY],
};

/**
 * Cargos que reciben trabajo en vez de administrar cuentas.
 *
 * Un diseñador o un editor no tiene cartera: el trabajo le llega asignado y puede ser de
 * cualquier cliente. Acotarlos por cuenta —como se acota a una community manager, que sí tiene
 * cartera— les deja la bandeja vacía aunque tengan trabajo esperando, porque el alcance por
 * cuenta se evalúa antes que el de área y no alcanza ninguna.
 *
 * Su límite no es la cuenta: es el área y lo que tienen asignado. Ver el nombre del cliente en
 * una solicitud de su área no es un acceso extra, es parte de poder hacer el trabajo.
 */
export const AREA_SCOPED_ROLES = new Set<UserRole>([
  UserRole.DESIGNER,
  UserRole.AUDIOVISUAL,
  UserRole.ART_DIRECTOR,
  UserRole.AV_DIRECTOR,
]);

/** Cargos que ven las tres áreas: administración y las direcciones transversales. */
const UNRESTRICTED_AREA_ROLES = new Set<UserRole>([
  UserRole.DEV,
  UserRole.ADMIN,
  UserRole.OPERATIONS_DIRECTOR,
  UserRole.COMMERCIAL_DIRECTOR,
  UserRole.CREATIVE_DIRECTOR,
]);

/** Nombre del área en los mensajes de error, para que digan algo accionable. */
const AREA_LABELS: Record<WorkRequestArea, string> = {
  [WorkRequestArea.DESIGN]: 'diseño',
  [WorkRequestArea.AUDIOVISUAL]: 'audiovisual',
  [WorkRequestArea.COMMUNITY]: 'community',
};

const TRANSITIONS: Record<WorkRequestStatus, WorkRequestStatus[]> = {
  [WorkRequestStatus.NEW]: [WorkRequestStatus.IN_REVIEW, WorkRequestStatus.REJECTED],
  [WorkRequestStatus.IN_REVIEW]: [WorkRequestStatus.ACCEPTED, WorkRequestStatus.REJECTED],
  [WorkRequestStatus.ACCEPTED]: [WorkRequestStatus.CONVERTED, WorkRequestStatus.REJECTED],
  [WorkRequestStatus.CONVERTED]: [],
  [WorkRequestStatus.REJECTED]: [],
};

@Injectable()
export class IntakeService {
  constructor(
    @InjectRepository(WorkRequest) private readonly requests: Repository<WorkRequest>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly udValues: UdValuesService,
    private readonly pieceTypes: PieceTypesService,
  ) {}

  /**
   * Crea una solicitud con correlativo por organización.
   *
   * El correlativo se calcula dentro de una transacción que primero bloquea la fila de la
   * organización. Se bloquea esa y no la última solicitud porque la fila de la organización
   * siempre existe: con la tabla vacía no hay última solicitud que bloquear y dos personas
   * creando a la vez obtendrían ambas el número 1, con el índice único rechazando a una con un
   * error que no explica nada.
   */
  async create(organizationId: string, requestedBy: string, dto: CreateWorkRequestDto, allowedClientIds?: string[]): Promise<WorkRequest> {
    await this.assertClient(organizationId, dto.clientId, allowedClientIds);

    return retryOnDeadlock('crear solicitud', () => this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Organization)
        .createQueryBuilder('o')
        .setLock('pessimistic_write')
        .where('o.id = :organizationId', { organizationId })
        .getOne();

      // El correlativo va con ceros a la izquierda, así que el orden alfabético del código
      // coincide con el numérico y no depende de la marca de tiempo, que empata entre
      // solicitudes creadas dentro del mismo segundo.
      const [last] = await manager.getRepository(WorkRequest).find({
        where: { organizationId },
        order: { code: 'DESC' },
        select: { id: true, code: true },
        take: 1,
      });

      const nextNumber = last?.code ? Number(last.code.replace(/\D/g, '')) + 1 : 1;
      const request = manager.create(WorkRequest, {
        ...dto,
        organizationId,
        requestedBy,
        code: `SOL-${String(nextNumber).padStart(5, '0')}`,
        status: WorkRequestStatus.NEW,
        neededBy: dto.neededBy ? new Date(dto.neededBy) : null,
      });
      return manager.save(WorkRequest, request);
    }));
  }

  /**
   * Bandeja de solicitudes.
   *
   * @param allowedClientIds - Cuentas que alcanza quien consulta; `undefined` es sin límite.
   * @param mine - Identificador de quien consulta, cuando solo quiere ver lo asignado a sí mismo.
   */
  async list(
    organizationId: string,
    filters: { status?: WorkRequestStatus; area?: string; clientId?: string; mine?: string },
    allowedClientIds?: string[],
    viewer?: { id: string; role: UserRole },
  ): Promise<{ data: WorkRequest[]; total: number }> {
    const scope = this.clientScope(filters.clientId, allowedClientIds);
    if (scope === EMPTY_SCOPE) return { data: [], total: 0 };

    const base: FindOptionsWhere<WorkRequest> = { organizationId };
    if (scope !== undefined) base.clientId = scope;
    if (filters.status) base.status = filters.status;
    if (filters.mine) base.assignedTo = filters.mine;

    const [data, total] = await this.requests.findAndCount({
      where: this.areaScope(base, filters.area, viewer),
      relations: ['client', 'requester', 'assignee'],
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return { data, total };
  }

  /**
   * Acota la bandeja a las áreas que alcanza el cargo de quien consulta.
   *
   * El área que llega por parámetro **filtra dentro de lo permitido y nunca lo amplía**: pedir
   * un área ajena no la abre, igual que ocurre con las cuentas. Un filtro que puede mostrar más
   * de lo que el cargo ve deja de ser un filtro y pasa a ser un agujero.
   *
   * Con `mine` no se acota por área: algo asignado a la persona se ve siempre, porque tiene que
   * hacerlo. Y en cualquier caso se ve lo que uno mismo pidió, aunque haya quedado en otra área:
   * quien abre una solicitud no siempre acierta, y que desaparezca al equivocarse convierte un
   * error de clasificación en una solicitud perdida.
   *
   * @param viewer - Sin valor no se acota; lo usan las llamadas internas que ya validaron acceso.
   */
  private areaScope(
    base: FindOptionsWhere<WorkRequest>,
    requestedArea?: string,
    viewer?: { id: string; role: UserRole },
  ): FindOptionsWhere<WorkRequest> | FindOptionsWhere<WorkRequest>[] {
    const asked = requestedArea as WorkRequestArea | undefined;
    const withArea = (area?: WorkRequestArea) => (area ? { ...base, area } : base);

    if (!viewer || UNRESTRICTED_AREA_ROLES.has(viewer.role)) return withArea(asked);
    if (base.assignedTo !== undefined) return withArea(asked);

    const visible = AREAS_BY_ROLE[viewer.role] ?? [];
    const areas = asked ? visible.filter((area) => area === asked) : visible;

    return [
      ...(areas.length ? [{ ...base, area: In(areas) }] : []),
      { ...base, requestedBy: viewer.id, ...(asked ? { area: asked } : {}) },
      { ...base, assignedTo: viewer.id, ...(asked ? { area: asked } : {}) },
    ];
  }

  async findOne(
    organizationId: string,
    id: string,
    allowedClientIds?: string[],
    viewer?: { id: string; role: UserRole },
  ): Promise<WorkRequest> {
    const request = await this.requests.findOne({ where: { id, organizationId }, relations: ['client', 'requester', 'assignee'] });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (allowedClientIds !== undefined && !allowedClientIds.includes(request.clientId)) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    this.assertAreaAccess(request, viewer);
    return request;
  }

  /** Asigna responsable y mueve el estado, validando la transición. */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateWorkRequestDto,
    allowedClientIds?: string[],
    viewer?: { id: string; role: UserRole },
  ): Promise<WorkRequest> {
    const request = await this.findOne(organizationId, id, allowedClientIds, viewer);
    this.assertCanCoordinate(request, viewer);

    if (dto.status && dto.status !== request.status) {
      const allowed = TRANSITIONS[request.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new ConflictException(`No se puede pasar de ${request.status} a ${dto.status}`);
      }
      if (dto.status === WorkRequestStatus.REJECTED && !dto.rejectionReason?.trim()) {
        // Sin motivo, una solicitud rechazada se vuelve a pedir igual la semana siguiente.
        throw new BadRequestException('Indica por qué se rechaza');
      }
      request.status = dto.status;
      if (dto.status === WorkRequestStatus.IN_REVIEW) request.reviewedAt = new Date();
      if (dto.status === WorkRequestStatus.ACCEPTED) request.acceptedAt = new Date();
      if (dto.status === WorkRequestStatus.REJECTED) request.resolvedAt = new Date();
    }

    if (dto.assignedTo !== undefined) {
      if (dto.assignedTo) {
        const assignee = await this.users.findOne({ where: { id: dto.assignedTo, organizationId, isActive: true }, select: { id: true, role: true } });
        if (!assignee) throw new BadRequestException('El responsable no es un usuario activo de la organización');
        // El área no es una etiqueta: cada una tiene su propia gente y su propio flujo. Un
        // diseñador no cubre un rodaje. Se comprueba acá y no solo en el formulario porque un
        // desplegable filtrado no impide mandar el identificador a mano.
        if (!ROLES_BY_AREA[request.area].includes(assignee.role as UserRole)) {
          throw new BadRequestException(`El responsable no pertenece al área de ${AREA_LABELS[request.area]}`);
        }
      }
      request.assignedTo = dto.assignedTo || null;
    }

    if (dto.priority) request.priority = dto.priority;
    if (dto.rejectionReason !== undefined) request.rejectionReason = dto.rejectionReason?.trim() || null;
    if (dto.operationalFields !== undefined) request.operationalFields = dto.operationalFields;

    return this.requests.save(request);
  }

  /**
   * Convierte una solicitud aceptada en el trabajo que corresponde a su área.
   *
   * **Cada área desemboca en un flujo distinto y no son intercambiables:**
   *
   * | Área | Destino | Por qué |
   * |---|---|---|
   * | Diseño | `pieces` | Tiene tipo gráfico, dificultad y consume unidades de dedicación |
   * | Audiovisual | `av_sessions` | Tiene fecha, locación y equipo; no consume UD ni tiene tipo gráfico |
   * | Community | — | Todavía no tiene destino propio, y no se fuerza a ninguno |
   *
   * Antes esto creaba una pieza gráfica cualquiera fuera el área, de modo que una sesión de
   * fotos terminaba en el tablero de diseño como «post simple», ocupando presupuesto de diseño
   * y apareciendo en la carga del diseñador equivocado.
   */
  async convert(
    organizationId: string,
    id: string,
    dto: ResolveWorkRequestDto,
    allowedClientIds?: string[],
    viewer?: { id: string; role: UserRole },
  ): Promise<WorkRequest> {
    const request = await this.findOne(organizationId, id, allowedClientIds, viewer);
    this.assertCanCoordinate(request, viewer);
    if (request.status !== WorkRequestStatus.ACCEPTED) {
      throw new ConflictException('Solo una solicitud aceptada se puede convertir');
    }

    if (request.area === WorkRequestArea.DESIGN) return this.convertToPieces(organizationId, request, dto);
    if (request.area === WorkRequestArea.AUDIOVISUAL) return this.convertToSession(organizationId, request, dto);

    // Community produce publicaciones, que viven en la parrilla de contenido y necesitan una
    // semana a la que pertenecer. Mientras esa decisión no esté tomada, la solicitud se acepta
    // y se trabaja fuera del sistema; convertirla en una pieza gráfica sería mentir sobre qué es.
    throw new ConflictException(
      'Una solicitud de community todavía no se convierte: falta definir su destino en la parrilla de contenido',
    );
  }

  /**
   * Aplica al detalle la misma barrera de área que ya protege la bandeja. Sin esta comprobación,
   * conocer un identificador permitía saltarse el filtro enviándolo directamente a la ruta.
   */
  private assertAreaAccess(request: WorkRequest, viewer?: { id: string; role: UserRole }): void {
    if (!viewer || UNRESTRICTED_AREA_ROLES.has(viewer.role)) return;
    if (request.requestedBy === viewer.id || request.assignedTo === viewer.id) return;
    if ((AREAS_BY_ROLE[viewer.role] ?? []).includes(request.area)) return;
    throw new NotFoundException('Solicitud no encontrada');
  }

  /** Solo coordinación transversal o la dirección responsable del área puede cambiarla. */
  private assertCanCoordinate(request: WorkRequest, viewer?: { id: string; role: UserRole }): void {
    if (!viewer || UNRESTRICTED_AREA_ROLES.has(viewer.role)) return;
    if (request.area === WorkRequestArea.DESIGN && viewer.role === UserRole.ART_DIRECTOR) return;
    if (request.area === WorkRequestArea.AUDIOVISUAL && viewer.role === UserRole.AV_DIRECTOR) return;
    throw new NotFoundException('Solicitud no encontrada');
  }

  /** Diseño: una solicitud puede dar varias piezas —un carrusel y sus historias—. */
  private async convertToPieces(organizationId: string, request: WorkRequest, dto: ResolveWorkRequestDto): Promise<WorkRequest> {
    if (dto.session) throw new BadRequestException('Una solicitud de diseño no agenda una sesión');
    if (!dto.pieces?.length) throw new BadRequestException('Indica al menos una pieza');
    const pieces = dto.pieces;

    // Los valores en unidades se resuelven antes de abrir la transacción: son una lectura de
    // configuración, no del trabajo que se está creando, y no tienen por qué alargar el bloqueo.
    await this.pieceTypes.assertUsable(organizationId, pieces.map((piece) => piece.type));
    const ud = await Promise.all(pieces.map((piece) => this.udValues.udFor(piece.type, piece.carouselSlides, organizationId)));

    return retryOnDeadlock('convertir solicitud en piezas', () => this.dataSource.transaction(async (manager) => {
      const created = await manager.save(Piece, pieces.map((piece, index) => manager.create(Piece, {
        organizationId,
        clientId: request.clientId,
        title: piece.title.trim(),
        type: piece.type,
        status: PieceStatus.BACKLOG,
        difficultyLevel: piece.difficultyLevel ?? 1,
        udAmount: ud[index],
        description: request.description ?? undefined,
        assignedTo: request.assignedTo ?? undefined,
        deadlineAt: request.neededBy ?? undefined,
      })));

      request.status = WorkRequestStatus.CONVERTED;
      request.resolvedAt = new Date();
      request.pieceIds = created.map((piece) => piece.id);
      return manager.save(WorkRequest, request);
    }));
  }

  /**
   * Audiovisual: una solicitud agenda **una** sesión de rodaje.
   *
   * Es una y no varias porque una sesión es un día de trabajo con un equipo en una locación. Si
   * hacen falta dos rodajes, son dos solicitudes: así cada uno tiene su fecha y su equipo.
   */
  private async convertToSession(organizationId: string, request: WorkRequest, dto: ResolveWorkRequestDto): Promise<WorkRequest> {
    if (dto.pieces?.length) throw new BadRequestException('Una solicitud audiovisual no crea piezas gráficas');
    if (!dto.session) throw new BadRequestException('Indica el tipo, la fecha y la locación de la sesión');
    const { session } = dto;

    // El responsable de la solicitud queda dentro del equipo aunque no lo repitan al agendar:
    // se le asignó justamente para que estuviera en el rodaje.
    const team = [...new Set([...(session.assignedTeam ?? []), ...(request.assignedTo ? [request.assignedTo] : [])])];
    await this.assertActiveUsers(organizationId, team);

    return retryOnDeadlock('convertir solicitud en sesión', () => this.dataSource.transaction(async (manager) => {
      const created = await manager.save(Session, manager.create(Session, {
        organizationId,
        clientId: request.clientId,
        type: session.type,
        date: new Date(session.date),
        location: session.location?.trim() || undefined,
        assignedTeam: team.length ? team : undefined,
        moodboardId: session.moodboardId,
        status: 'scheduled',
      }));

      request.status = WorkRequestStatus.CONVERTED;
      request.resolvedAt = new Date();
      request.sessionId = created.id;
      return manager.save(WorkRequest, request);
    }));
  }

  /** Rechaza el lote completo si alguno no es usuario activo de la organización. */
  private async assertActiveUsers(organizationId: string, userIds: string[]): Promise<void> {
    if (!userIds.length) return;
    const found = await this.users.count({ where: { id: In(userIds), organizationId, isActive: true } });
    if (found !== userIds.length) throw new BadRequestException('El equipo asignado contiene usuarios inválidos');
  }

  /**
   * Quién puede hacerse cargo del trabajo de un área.
   *
   * Cada área tiene su propia gente y no se mezclan: un diseñador no cubre un rodaje y un
   * editor de video no arma un carrusel. Ofrecer una sola lista para las tres áreas hacía que
   * asignar una sesión de fotos a un diseñador fuera un clic tan fácil como el correcto.
   */
  async assigneeOptions(organizationId: string, area: WorkRequestArea): Promise<User[]> {
    return this.users.find({
      select: { id: true, name: true, role: true, weeklyCapacityUd: true },
      where: { organizationId, isActive: true, role: In(ROLES_BY_AREA[area]) },
      order: { name: 'ASC' },
    });
  }

  /**
   * Conteo por estado, para las columnas de la bandeja.
   *
   * Usa el mismo alcance que `list`: si contara sobre un universo distinto, las columnas
   * mostrarían un número y la lista otro, y el usuario creería que le falta trabajo por ver.
   */
  async counts(
    organizationId: string,
    allowedClientIds?: string[],
    viewer?: { id: string; role: UserRole },
  ): Promise<Record<string, number>> {
    if (allowedClientIds?.length === 0) return {};
    const base: FindOptionsWhere<WorkRequest> = { organizationId };
    if (allowedClientIds) base.clientId = In(allowedClientIds);

    const rows = await this.requests.createQueryBuilder('r')
      .select('r.status', 'status').addSelect('COUNT(*)', 'total')
      .where(this.areaScope(base, undefined, viewer))
      .groupBy('r.status')
      .getRawMany<{ status: string; total: string }>();
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]));
  }

  private async assertClient(organizationId: string, clientId: string, allowedClientIds?: string[]): Promise<void> {
    const client = await this.clients.findOne({ where: { id: clientId, organizationId }, select: { id: true } });
    if (!client) throw new BadRequestException('La cuenta no pertenece a esta organización');
    if (allowedClientIds !== undefined && !allowedClientIds.includes(clientId)) {
      throw new NotFoundException('Cuenta no encontrada');
    }
  }

  private clientScope(clientId?: string, allowedClientIds?: string[]): FindOptionsWhere<WorkRequest>['clientId'] | typeof EMPTY_SCOPE {
    if (allowedClientIds === undefined) return clientId;
    if (allowedClientIds.length === 0) return EMPTY_SCOPE;
    if (clientId) return allowedClientIds.includes(clientId) ? clientId : EMPTY_SCOPE;
    return In(allowedClientIds);
  }
}
