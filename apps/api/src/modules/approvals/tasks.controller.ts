import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedRequest } from '@shared/types/request';
import { ModuleExempt } from '../../core/authorization/module-scope.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../crm/leads/lead.entity';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { ClientCapabilityService } from '../../core/client-scope/client-capability.service';
import { PermissionResolverService } from '../../core/authorization/permission-resolver.service';
import { UserRole } from '../organizations/user-role.enum';

/**
 * Tareas: pendientes con dueño y fecha sobre cualquier registro.
 *
 * No lleva `@Roles`: una tarea es trabajo asignado, y cualquier cargo interno puede tener una,
 * abrirla o cerrarla. Lo que sí acota es el módulo —quien no alcanza el CRM no ve tareas de un
 * prospecto— y el alcance por cuenta que ya aplica cada pantalla.
 *
 * Va bajo `/tasks` y no bajo `/approvals` aunque compartan tabla: son dos bandejas distintas
 * para dos públicos distintos, y mezclarlas llenaría la del cliente de trabajo interno.
 */
/*
  Sin módulo propio, y declarado.

  `PermissionGuard` rechaza todo endpoint que no declare módulo ni exención: negar por omisión
  es lo que hace que la pantalla de permisos gobierne de verdad. Este controlador no declaraba
  ninguna de las dos cosas, así que **respondía 403 a todo el mundo, siempre** —incluido el
  panel de tareas de la ficha del lead, que se dibujaba y no podía cargar ni una—.

  La exención es la respuesta correcta y no un atajo: una tarea es trabajo asignado a una
  persona sobre un registro que puede ser un lead, una oportunidad, una pieza o una sesión.
  Atarla a un módulo obligaría a elegir uno de esos cinco, y las tareas de los otros cuatro
  dejarían de funcionar cada vez que ese módulo se apagara.

  El servicio acota por organización y por el registro pedido; quién puede abrir ese registro lo
  gobierna el módulo de ese registro, que es donde corresponde.
*/
@ApiTags('Tareas')
@Controller('tasks')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleExempt('Trabajo asignado sobre registros de cinco módulos distintos; no pertenece a ninguno')
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    private readonly accountAccess: AccountAccessService,
    private readonly capabilities: ClientCapabilityService,
    private readonly permissions: PermissionResolverService,
  ) {}

  @Get('mine')
  @ApiOperation({ summary: 'Lo que tengo pendiente, lo más vencido primero' })
  mine(@Req() req: AuthenticatedRequest, @Query('limit') limit?: string) {
    return this.tasks.listMine(req.organizationId, req.user.id, limit ? Number(limit) : undefined);
  }

  @Get(':entityType/:entityId')
  @ApiOperation({ summary: 'Tareas de un registro' })
  async forEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertEntityAccess(req, entityType, entityId, 'view');
    return this.tasks.listForEntity(req.organizationId, entityType, entityId);
  }

  @Post()
  @ApiOperation({ summary: 'Abrir una tarea sobre un registro' })
  async create(@Body() dto: CreateTaskDto, @Req() req: AuthenticatedRequest) {
    const clientId = await this.assertEntityAccess(req, dto.entityType, dto.entityId, 'edit');
    return this.tasks.create(req.organizationId, req.user.id, { ...dto, clientId });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Completar, cancelar o reasignar una tarea' })
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Req() req: AuthenticatedRequest) {
    const task = await this.tasks.findOne(req.organizationId, id);
    await this.assertEntityAccess(req, task.entityType, task.entityId, 'edit');
    return this.tasks.update(req.organizationId, id, dto);
  }

  /** Las tareas de CRM heredan exactamente el alcance del lead al que pertenecen. */
  private async assertEntityAccess(
    req: AuthenticatedRequest,
    entityType: string,
    entityId: string,
    level: 'view' | 'edit',
  ): Promise<string | undefined> {
    if (entityType !== 'lead') {
      if (req.user.role === 'client') throw new ForbiddenException('El portal solo administra tareas de su CRM');
      return undefined;
    }
    const lead = await this.leads.findOne({
      where: { id: entityId, organizationId: req.organizationId }, select: { id: true, clientId: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (!await this.permissions.can(req.organizationId, req.user.id, req.user.role as UserRole, 'crm', level)) {
      throw new ForbiddenException('No tienes acceso al CRM');
    }
    const clientId = lead.clientId ?? undefined;
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    if (!clientId && allowed !== undefined) throw new NotFoundException('Lead not found');
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    await this.capabilities.assert(req.organizationId, clientId, 'crm');
    return clientId;
  }
}
