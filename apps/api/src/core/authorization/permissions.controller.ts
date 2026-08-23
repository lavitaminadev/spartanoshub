import { Body, Controller, Delete, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PermissionResolverService } from './permission-resolver.service';
import { UserPermissionOverride } from './user-permission-override.entity';
import { RolePermissionOverride } from './role-permission-override.entity';
import { UpsertPermissionOverrideDto } from './dto/upsert-permission-override.dto';
import { UpdateRoleMatrixDto } from './dto/update-role-matrix.dto';
import { Roles } from './roles.decorator';
import { RequiresRecentAuth } from '../auth/requires-recent-auth.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { User } from '../../modules/users/user.entity';
import { isOrganizationFeatureKey, ORGANIZATION_FEATURE_KEYS, type OrganizationFeatureKey } from '../../modules/organizations/organization-features';
import { isPermissionLevel, type PermissionLevel } from './permission-level';
import { roleLevel } from './role-permissions';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { ModuleScope } from '../authorization/module-scope.decorator';
import { AccountAccessService } from '../client-scope/account-access.service';
import { UserClientAccess } from '../client-scope/user-client-access.entity';
import { GrantClientAccessDto } from './dto/grant-client-access.dto';
import { Client } from '../../modules/clients/client.entity';

/**
 * Consulta y administración de permisos por módulo.
 */
@ApiTags('Permisos')
@Controller()
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('users')
export class PermissionsController {
  constructor(
    private readonly permissions: PermissionResolverService,
    @InjectRepository(UserPermissionOverride) private readonly overrides: Repository<UserPermissionOverride>,
    @InjectRepository(RolePermissionOverride) private readonly roleOverrides: Repository<RolePermissionOverride>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserClientAccess) private readonly clientAccess: Repository<UserClientAccess>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    private readonly accountAccess: AccountAccessService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Matriz completa de cargos, con la procedencia de cada celda.
   *
   * `matrix[módulo][cargo]` es el nivel vigente y `sources[módulo][cargo]` dice si sale del
   * código (`code`) o de un ajuste guardado para esta organización (`override`). Sin esa
   * segunda mitad, el panel no puede distinguir un valor por defecto de uno movido a mano, que
   * es justo lo que hay que saber para decidir si tocarlo.
   */
  @Get('roles/permissions')
  // Administración también: es el cargo del dueño de la organización y ajustar quién ve qué es
  // precisamente lo que hace desde configuración, sin depender de desarrollo.
  @Roles(UserRole.DEV, UserRole.ADMIN)
  @ApiOperation({ summary: 'Matriz de permisos por cargo y módulo' })
  async roleMatrix(@Req() req: AuthenticatedRequest) {
    return this.permissions.roleMatrix(req.organizationId);
  }

  /**
   * Guarda la matriz de cargos como diferencias respecto del código.
   *
   * Recibe la matriz completa y persiste solo las celdas que se apartan de
   * `role-permissions.ts`. Una celda que vuelve a su valor de código borra su ajuste, de modo
   * que a partir de ahí sigue al código si este cambia: guardar el mismo valor la congelaría.
   *
   * Los módulos que el catálogo no conoce y los cargos inexistentes se rechazan enteros en vez
   * de ignorarse, para que un panel desactualizado no guarde en silencio una matriz parcial.
   */
  @Put('roles/permissions')
  @Roles(UserRole.DEV, UserRole.ADMIN)
  // La reautenticación reciente se conserva: abrir la matriz a administración amplía quién
  // puede cambiarla, no relaja la comprobación de que sea esa persona quien está al teclado.
  @RequiresRecentAuth('cambiar los permisos de un cargo')
  @ApiOperation({ summary: 'Guardar la matriz de permisos por cargo' })
  async updateRoleMatrix(@Body() dto: UpdateRoleMatrixDto, @Req() req: AuthenticatedRequest) {
    const organizationId = req.organizationId;
    const validRoles = new Set<string>(Object.values(UserRole));

    /** Celdas que difieren del código, ya validadas. */
    const desired = new Map<string, { role: UserRole; module: OrganizationFeatureKey; level: PermissionLevel }>();
    for (const [module, byRole] of Object.entries(dto.matrix ?? {})) {
      if (!isOrganizationFeatureKey(module)) throw new BadRequestException(`Módulo desconocido: ${module}`);
      for (const [role, level] of Object.entries(byRole ?? {})) {
        if (!validRoles.has(role)) throw new BadRequestException(`Cargo desconocido: ${role}`);
        if (!isPermissionLevel(level)) throw new BadRequestException(`Nivel desconocido: ${level}`);
        if (level === this.permissions.codeLevel(role as UserRole, module)) continue;
        desired.set(`${role}:${module}`, { role: role as UserRole, module, level });
      }
    }

    const existing = await this.roleOverrides.find({ where: { organizationId } });
    const before: Record<string, string> = {};
    const after: Record<string, string> = {};

    const obsolete = existing.filter((row) => !desired.has(`${row.role}:${row.module}`));
    for (const row of obsolete) {
      before[`${row.role}:${row.module}`] = row.level;
      after[`${row.role}:${row.module}`] = isOrganizationFeatureKey(row.module)
        ? this.permissions.codeLevel(row.role as UserRole, row.module)
        : 'none';
    }
    if (obsolete.length > 0) await this.roleOverrides.remove(obsolete);

    const existingByCell = new Map(existing.map((row) => [`${row.role}:${row.module}`, row]));
    const toSave = [];
    for (const [key, cell] of desired) {
      const current = existingByCell.get(key);
      if (current?.level === cell.level) continue;
      before[key] = current?.level ?? this.permissions.codeLevel(cell.role, cell.module);
      after[key] = cell.level;
      toSave.push({
        ...(current ?? {}),
        organizationId,
        role: cell.role,
        module: cell.module,
        level: cell.level,
        reason: dto.reason ?? null,
        grantedBy: req.user.id,
      });
    }
    if (toSave.length > 0) await this.roleOverrides.save(toSave);

    // El nivel de cualquier persona de la organización puede depender de lo que cambió.
    this.permissions.invalidateOrganization(organizationId);

    if (Object.keys(after).length > 0) {
      await this.audit.log({
        organizationId,
        actorId: req.user.id,
        entityType: 'RolePermissionOverride',
        entityId: organizationId,
        action: 'updated',
        before,
        after,
        reason: dto.reason,
      });
    }

    return { ...(await this.permissions.roleMatrix(organizationId)), changed: Object.keys(after).length };
  }

  /**
   * Todas las excepciones por persona de la organización.
   *
   * El detalle por usuario (`GET users/:id/permissions`) responde "qué alcanza esta persona";
   * este listado responde "qué excepciones existen", que es la pregunta de una revisión de
   * accesos y no se puede contestar recorriendo usuario por usuario.
   *
   * Una excepción vencida se devuelve con `status: 'expired'` y ya no concede nada: la fila se
   * conserva como constancia de lo que se otorgó.
   */
  @Get('permission-overrides')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Excepciones de permiso de toda la organización' })
  async listOverrides(@Req() req: AuthenticatedRequest) {
    const rows = await this.overrides.find({
      where: { organizationId: req.organizationId },
      order: { createdAt: 'DESC' },
    });
    if (rows.length === 0) return { data: [] };

    const owners = await this.users.find({
      where: { id: In([...new Set(rows.map((row) => row.userId))]) },
      select: { id: true, name: true, role: true },
    });
    const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
    const now = Date.now();

    const excepciones = rows.filter((row) => {
        if (req.user.role === UserRole.DEV) return true;
        return ownerById.get(row.userId)?.role !== UserRole.DEV;
      }).map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: ownerById.get(row.userId)?.name ?? 'Usuario no disponible',
        userRole: ownerById.get(row.userId)?.role,
        module: row.module,
        level: row.level,
        reason: row.reason ?? undefined,
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
        status: row.expiresAt && row.expiresAt.getTime() <= now ? 'expired' : 'active',
        createdAt: row.createdAt?.toISOString(),
    }));

    // `data`, como todas las listas del sistema.
    return { data: excepciones };
  }

  /**
   * Permisos efectivos del usuario autenticado.
   *
   * El frontend construye el menú con esta respuesta, de modo que lo visible coincide
   * exactamente con lo que el backend autoriza.
   */
  @Get('me/permissions')
  @Roles(...Object.values(UserRole))
  @ApiOperation({ summary: 'Permisos efectivos del usuario autenticado' })
  async mine(@Req() req: AuthenticatedRequest) {
    const permissions = await this.permissions.permissionsFor(req.organizationId, req.user.id, req.user.role as UserRole);
    return { permissions };
  }

  /**
   * Permisos que tendría un cargo, para previsualizar la aplicación con sus ojos.
   *
   * Es una consulta de solo lectura: **no cambia lo que quien pregunta puede hacer**. La
   * sesión sigue siendo la suya y cada petición posterior se autoriza con sus propios
   * permisos. La respuesta solo sirve para que la interfaz dibuje el menú y las pantallas de
   * ese cargo.
   *
   * Se acota a la administración porque es una herramienta de verificación de la matriz de
   * permisos, no una función de uso diario, y porque saber exactamente qué alcanza cada cargo
   * es justo lo que le sirve a quien prepara un ataque interno.
   *
   * Se devuelve el nivel del cargo sin las excepciones de ninguna persona concreta: mezclarlas
   * mostraría el acceso real de alguien identificable, que es otra cosa y más sensible.
   */
  @Get('roles/:role/permissions')
  @Roles(UserRole.DEV, UserRole.ADMIN)
  @ApiOperation({ summary: 'Permisos de un cargo, para previsualizacion' })
  async ofRole(@Param('role') role: string, @Req() req: AuthenticatedRequest) {
    if (!Object.values(UserRole).includes(role as UserRole)) throw new NotFoundException('Cargo no encontrado');

    const permissions = Object.fromEntries(
      ORGANIZATION_FEATURE_KEYS.map((module) => [module, roleLevel(role as UserRole, module)]),
    );
    // Queda registrado quién miró qué cargo: es lectura, pero es lectura de la configuración
    // de acceso, y en una revisión conviene poder reconstruir quién la estuvo explorando.
    void this.audit.log({
      organizationId: req.organizationId,
      actorId: req.user.id,
      entityType: 'authorization_roles',
      entityId: role,
      action: 'previewed',
      ipAddress: req.ip,
    }).catch(() => {});

    return { role, permissions };
  }

  /**
   * Detalle de permisos de un usuario, indicando qué proviene del cargo y qué de una
   * excepción.
   */
  @Get('users/:id/permissions')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Detalle de permisos de un usuario' })
  async ofUser(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const user = await this.findUser(id, req.organizationId);
    return {
      userId: user.id,
      role: user.role,
      modules: await this.permissions.explain(req.organizationId, user.id, user.role as UserRole),
    };
  }

  /**
   * Crea o reemplaza la excepción de un usuario sobre un módulo.
   *
   * Usar `level: 'none'` deniega de forma explícita un módulo que el cargo sí concede.
   */
  @Put('users/:id/permissions/:module')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Definir una excepción de permiso' })
  async upsert(
    @Param('id') id: string,
    @Param('module') module: string,
    @Body() dto: UpsertPermissionOverrideDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!isOrganizationFeatureKey(module)) throw new BadRequestException(`Módulo desconocido: ${module}`);
    const user = await this.findUser(id, req.organizationId);
    this.assertCanManageUserPermissionException(req.user.role as UserRole, user);
    const existing = await this.overrides.findOne({ where: { userId: user.id, module } });
    const saved = await this.overrides.save({
      ...(existing ?? {}),
      organizationId: req.organizationId,
      userId: user.id,
      module,
      level: dto.level,
      reason: dto.reason ?? null,
      // El formulario admite excepciones temporales. Omitir esta asignación hacía que el
      // botón pareciera aceptar una fecha pero dejaba la excepción permanente en la base.
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      grantedBy: req.user.id,
    });
    this.permissions.invalidateUser(user.id);
    await this.audit.log({
      organizationId: req.organizationId,
      actorId: req.user.id,
      entityType: 'UserPermissionOverride',
      entityId: saved.id,
      action: existing ? 'updated' : 'created',
      before: existing ? { level: existing.level, reason: existing.reason } : undefined,
      after: { module, level: dto.level, reason: dto.reason ?? null, expiresAt: dto.expiresAt ?? null },
    });
    return saved;
  }

  /** Elimina la excepción y devuelve el módulo al nivel que define el cargo. */
  @Delete('users/:id/permissions/:module')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Quitar una excepción de permiso' })
  async remove(@Param('id') id: string, @Param('module') module: string, @Req() req: AuthenticatedRequest) {
    if (!isOrganizationFeatureKey(module)) throw new BadRequestException(`Módulo desconocido: ${module}`);
    const user = await this.findUser(id, req.organizationId);
    this.assertCanManageUserPermissionException(req.user.role as UserRole, user);
    const existing = await this.overrides.findOne({ where: { userId: user.id, module } });
    if (!existing) throw new NotFoundException('No existe una excepción para ese módulo');
    await this.overrides.remove(existing);
    this.permissions.invalidateUser(user.id);
    await this.audit.log({
      organizationId: req.organizationId,
      actorId: req.user.id,
      entityType: 'UserPermissionOverride',
      entityId: existing.id,
      action: 'deleted',
      before: { module, level: existing.level, reason: existing.reason },
    });
    return { removed: true, module };
  }

  /**
   * Cuentas que ve una persona, con la procedencia de cada una.
   *
   * Distingue lo heredado del pod de lo concedido a mano, que es lo que permite revisar
   * accesos sin reconstruir la decisión: las excepciones se ven como excepciones.
   */
  @Get('users/:id/client-access')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Cuentas visibles de un usuario y por qué las ve' })
  async clientAccessOfUser(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const user = await this.findUser(id, req.organizationId);
    const access = await this.accountAccess.explain(req.organizationId, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      clientId: user.clientId,
      tenantId: user.organizationId,
    });
    return { userId: user.id, role: user.role, access };
  }

  /** Concede a una persona una cuenta que su pod no le da. */
  @Put('users/:id/client-access/:clientId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Conceder acceso a una cuenta' })
  async grantClientAccess(
    @Param('id') id: string,
    @Param('clientId') clientId: string,
    @Body() dto: GrantClientAccessDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.findUser(id, req.organizationId);
    if (user.role === UserRole.CLIENT) {
      throw new BadRequestException('El acceso de un cliente lo define su propia cuenta, no una asignación');
    }
    const client = await this.clients.findOne({ where: { id: clientId, organizationId: req.organizationId }, select: { id: true } });
    if (!client) throw new NotFoundException('Cuenta no encontrada');

    const existing = await this.clientAccess.findOne({ where: { userId: user.id, clientId: client.id } });
    const saved = await this.clientAccess.save({
      ...(existing ?? {}),
      organizationId: req.organizationId,
      userId: user.id,
      clientId: client.id,
      reason: dto.reason ?? null,
      grantedBy: req.user.id,
    });
    this.accountAccess.invalidateUser(user.id);
    await this.audit.log({
      organizationId: req.organizationId,
      actorId: req.user.id,
      entityType: 'UserClientAccess',
      entityId: saved.id,
      action: existing ? 'updated' : 'created',
      before: existing ? { reason: existing.reason } : undefined,
      after: { userId: user.id, clientId: client.id, reason: dto.reason ?? null },
    });
    return saved;
  }

  /**
   * Retira una asignación directa.
   *
   * No quita el acceso que venga del pod: para eso hay que sacar a la persona del pod o
   * mover la cuenta. La respuesta indica si, tras retirarla, la cuenta le sigue siendo
   * visible, para que quien administra no crea haber cerrado algo que sigue abierto.
   */
  @Delete('users/:id/client-access/:clientId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Retirar acceso a una cuenta' })
  async revokeClientAccess(
    @Param('id') id: string,
    @Param('clientId') clientId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.findUser(id, req.organizationId);
    const existing = await this.clientAccess.findOne({ where: { userId: user.id, clientId } });
    if (!existing) throw new NotFoundException('No existe una asignación directa para esa cuenta');

    await this.clientAccess.remove(existing);
    this.accountAccess.invalidateUser(user.id);
    await this.audit.log({
      organizationId: req.organizationId,
      actorId: req.user.id,
      entityType: 'UserClientAccess',
      entityId: existing.id,
      action: 'deleted',
      before: { userId: user.id, clientId, reason: existing.reason },
    });

    const remaining = await this.accountAccess.allowedClientIds(req.organizationId, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      clientId: user.clientId,
      tenantId: user.organizationId,
    });
    return {
      removed: true,
      clientId,
      stillVisible: remaining === undefined || remaining.includes(clientId),
    };
  }

  /**
   * Busca un usuario dentro de la organización de quien consulta.
   *
   * @throws NotFoundException si el usuario no existe o pertenece a otra organización.
   */
  private async findUser(id: string, organizationId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  /**
   * Las excepciones puntuales son operación diaria de administración; tocar cuentas dev ya es
   * gobierno de plataforma. Eso queda reservado al mismo rol que maneja matriz, módulos y
   * ciclo de vida para que admin no pueda degradar o elevar al usuario técnico por accidente.
   */
  private assertCanManageUserPermissionException(actorRole: UserRole, target: User): void {
    if (actorRole === UserRole.DEV) return;
    if (target.role === UserRole.DEV) {
      throw new ForbiddenException('Las excepciones de una cuenta dev solo pueden administrarse con rol dev');
    }
  }
}
