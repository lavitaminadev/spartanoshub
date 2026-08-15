import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PieceTypeArea, PieceTypeDefinition, PieceTypeStatus } from './piece-type-definition.entity';
import { UserRole } from '../organizations/user-role.enum';
import { PieceType } from './piece-type.enum';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';
import { CreatePieceTypeDto, UpdatePieceTypeDto } from './dto/piece-type.dto';

/** Cargos que siempre pueden aprobar, además del que se configure. */
const ALWAYS_APPROVE = new Set<UserRole>([UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR]);

/**
 * Quién puede proponer un tipo en cada área.
 *
 * Proponer no es aprobar: lo hace quien conoce el formato porque lo produce. La atribución de
 * aprobarlo es otra y se configura aparte.
 */
const PROPOSE_ROLES: Record<PieceTypeArea, UserRole[]> = {
  [PieceTypeArea.DESIGN]: [UserRole.DESIGNER, UserRole.ART_DIRECTOR],
  [PieceTypeArea.AUDIOVISUAL]: [UserRole.AUDIOVISUAL, UserRole.AV_DIRECTOR],
};

/** Identificador estable a partir del nombre: minúsculas, sin acentos, con guion bajo. */
function toKey(label: string): string {
  return label.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

/**
 * Catálogo de tipos de pieza de una organización.
 *
 * Un tipo nuevo nace propuesto, no activo. Recién cuando quien tiene la atribución lo aprueba
 * aparece en los formularios y empieza a descontar presupuesto. Ese paso existe porque el
 * catálogo es con lo que se le cobra al cliente: dejarlo abierto lo llenaría de tipos duplicados
 * y de precios que nadie revisó.
 *
 * Quién aprueba es configurable en `production.piece_type_approver_role`. Administración y
 * Operaciones pueden siempre, para que la atribución no quede sin titular si alguien configura
 * un cargo que después deja de existir.
 */
@Injectable()
export class PieceTypesService {
  constructor(
    @InjectRepository(PieceTypeDefinition) private readonly types: Repository<PieceTypeDefinition>,
    private readonly parameters: ParameterResolver,
  ) {}

  /**
   * Tipos que quien consulta puede usar o revisar.
   *
   * Un formulario pide solo los activos de su área: ofrecer un tipo aún no aprobado haría que se
   * registre trabajo contra algo que todavía se está discutiendo. Quien aprueba ve además los
   * pendientes, porque son los que tiene que resolver.
   */
  async list(
    organizationId: string,
    viewer: { role: UserRole },
    filters: { area?: PieceTypeArea; includeInactive?: boolean } = {},
  ): Promise<PieceTypeDefinition[]> {
    const estados = filters.includeInactive && (await this.canApprove(organizationId, viewer.role))
      ? [PieceTypeStatus.DRAFT, PieceTypeStatus.PENDING_APPROVAL, PieceTypeStatus.ACTIVE, PieceTypeStatus.RETIRED]
      : [PieceTypeStatus.ACTIVE];

    return this.types.find({
      where: {
        organizationId,
        status: In(estados),
        ...(filters.area ? { area: filters.area } : {}),
      },
      order: { area: 'ASC', label: 'ASC' },
    });
  }

  /** Tipos activos de un área, que es lo que necesita un formulario para armar su selector. */
  async activeFor(organizationId: string, area: PieceTypeArea): Promise<PieceTypeDefinition[]> {
    return this.types.find({
      where: { organizationId, area, status: PieceTypeStatus.ACTIVE },
      order: { label: 'ASC' },
    });
  }

  /**
   * Propone un tipo nuevo.
   *
   * Nace en `pending_approval` y no en `active`: quien lo propone conoce el formato, pero cuánto
   * descuenta del presupuesto del cliente es una decisión económica que le corresponde a otro.
   */
  async propose(organizationId: string, dto: CreatePieceTypeDto, requestedBy: string, role: UserRole): Promise<PieceTypeDefinition> {
    const area = dto.area ?? PieceTypeArea.DESIGN;
    const puedeProponer = ALWAYS_APPROVE.has(role) || PROPOSE_ROLES[area].includes(role);
    if (!puedeProponer) {
      throw new ForbiddenException(`Un tipo de pieza de ${area} lo propone quien trabaja en esa área o la dirección`);
    }

    const key = dto.key ? toKey(dto.key) : toKey(dto.label);
    if (!key) throw new BadRequestException('El nombre del tipo debe tener al menos una letra o número');

    const existing = await this.types.findOne({ where: { organizationId, key } });
    if (existing) {
      throw new BadRequestException(`Ya existe un tipo con el identificador «${key}» (${existing.label}, ${existing.status})`);
    }

    return this.types.save(this.types.create({
      organizationId,
      key,
      label: dto.label.trim(),
      area,
      udAmount: dto.udAmount ?? null,
      extraPerUnit: dto.extraPerUnit ?? null,
      xpWeight: dto.xpWeight ?? 1,
      isPrint: dto.isPrint ?? false,
      status: PieceTypeStatus.PENDING_APPROVAL,
      requestedBy,
      notes: dto.notes?.trim(),
    }));
  }

  /**
   * Aprueba un tipo y lo pone en circulación.
   *
   * Se puede corregir el valor al aprobar, que es el momento en que la decisión económica se
   * toma de verdad: quien propuso sugiere, quien aprueba fija.
   */
  async approve(organizationId: string, id: string, role: UserRole, approvedBy: string, ajustes?: UpdatePieceTypeDto): Promise<PieceTypeDefinition> {
    if (!(await this.canApprove(organizationId, role))) {
      throw new ForbiddenException('Tu cargo no tiene la atribución de aprobar tipos de pieza');
    }
    const type = await this.find(organizationId, id);
    if (type.status === PieceTypeStatus.ACTIVE) return type;

    if (ajustes) this.applyEdits(type, ajustes);
    type.status = PieceTypeStatus.ACTIVE;
    type.approvedBy = approvedBy;
    type.approvedAt = new Date();
    return this.types.save(type);
  }

  /**
   * Corrige un tipo ya en uso.
   *
   * El identificador no se toca: las piezas ya creadas lo guardan y renombrarlo las dejaría
   * apuntando a un tipo que no existe. Cambiar el valor tampoco altera lo ya cobrado, porque cada
   * pieza guardó su monto al crearse.
   */
  async update(organizationId: string, id: string, role: UserRole, dto: UpdatePieceTypeDto): Promise<PieceTypeDefinition> {
    if (!(await this.canApprove(organizationId, role))) {
      throw new ForbiddenException('Tu cargo no tiene la atribución de editar el catálogo de tipos');
    }
    const type = await this.find(organizationId, id);
    this.applyEdits(type, dto);
    return this.types.save(type);
  }

  /**
   * Retira un tipo de circulación.
   *
   * No se borra: las piezas que lo usaron conservan su tipo y su cobro, y borrarlo dejaría el
   * historial del cliente apuntando a nada. Retirado deja de ofrecerse y nada más.
   */
  async retire(organizationId: string, id: string, role: UserRole, reason?: string): Promise<PieceTypeDefinition> {
    if (!(await this.canApprove(organizationId, role))) {
      throw new ForbiddenException('Tu cargo no tiene la atribución de retirar tipos de pieza');
    }
    const type = await this.find(organizationId, id);
    type.status = PieceTypeStatus.RETIRED;
    if (reason) type.notes = reason.slice(0, 500);
    return this.types.save(type);
  }

  /**
   * Verifica que los tipos pedidos existan y estén en circulación.
   *
   * Reemplaza a la validación contra el `enum`, que rechazaba cualquier tipo aprobado después de
   * compilar y volvía inútil poder crearlos. Acepta también los tipos del maestro que la
   * organización todavía no haya sembrado, para que un catálogo vacío no bloquee la operación.
   */
  async assertUsable(organizationId: string, keys: string[]): Promise<void> {
    const pedidos = [...new Set(keys)];
    if (!pedidos.length) return;

    const encontrados = await this.types.find({
      where: { organizationId, key: In(pedidos), status: PieceTypeStatus.ACTIVE },
      select: { key: true },
    });
    const activos = new Set(encontrados.map((type) => type.key));
    const delMaestro = new Set<string>(Object.values(PieceType));

    const invalidos = pedidos.filter((key) => !activos.has(key) && !delMaestro.has(key));
    if (invalidos.length) {
      throw new BadRequestException(
        `Estos tipos de pieza no están activos en el catálogo: ${invalidos.join(', ')}. Propónlos y espera su aprobación antes de usarlos.`,
      );
    }
  }

  /** Si el cargo tiene hoy la atribución de aprobar, según la configuración vigente. */
  async canApprove(organizationId: string, role: UserRole): Promise<boolean> {
    if (ALWAYS_APPROVE.has(role)) return true;
    const configurado = await this.parameters.get('production.piece_type_approver_role', null, null, organizationId);
    return typeof configurado === 'string' && configurado === role;
  }

  private applyEdits(type: PieceTypeDefinition, dto: UpdatePieceTypeDto): void {
    if (dto.label !== undefined) type.label = dto.label.trim();
    if (dto.udAmount !== undefined) type.udAmount = dto.udAmount;
    if (dto.extraPerUnit !== undefined) type.extraPerUnit = dto.extraPerUnit;
    if (dto.xpWeight !== undefined) type.xpWeight = dto.xpWeight;
    if (dto.isPrint !== undefined) type.isPrint = dto.isPrint;
    if (dto.notes !== undefined) type.notes = dto.notes.trim().slice(0, 500);
  }

  private async find(organizationId: string, id: string): Promise<PieceTypeDefinition> {
    const type = await this.types.findOne({ where: { id, organizationId } });
    if (!type) throw new NotFoundException('Tipo de pieza no encontrado');
    return type;
  }
}
