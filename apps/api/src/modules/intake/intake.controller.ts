import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Roles } from '../../core/authorization/roles.decorator';
import { RequiresPermission } from '../../core/authorization/requires-permission.decorator';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { UserRole } from '../organizations/user-role.enum';
import { AREA_SCOPED_ROLES, IntakeService } from './intake.service';
import { CreateWorkRequestDto, ResolveWorkRequestDto, UpdateWorkRequestDto } from './dto/work-request.dto';
import { WorkRequestArea, WorkRequestStatus } from './work-request.entity';

/**
 * Puerta de entrada única a producción.
 *
 * Se declara sobre el módulo `production` y no sobre uno propio porque es la misma operación
 * vista desde antes: quien puede ver el tablero puede ver lo que va a entrar en él. Un módulo
 * aparte obligaría a mantener dos listas de permisos que describen lo mismo.
 */
@ApiTags('Solicitudes')
@ApiBearerAuth()
@Controller('intake/requests')
@UseGuards(AuthGuard('jwt'))
@ModuleScope('production')
export class IntakeController {
  constructor(
    private readonly intake: IntakeService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  /**
   * Cuentas que acota a quien consulta, o `undefined` si su cargo no se acota por cuenta.
   *
   * Diseño y audiovisual reciben trabajo, no administran cartera: su bandeja se limita por área
   * y por lo que tienen asignado, no por cliente. Pasarles el alcance por cuenta les vaciaba la
   * bandeja, porque ese filtro se evalúa primero y ellos no alcanzan ninguna cuenta.
   */
  private async clientScope(req: AuthenticatedRequest): Promise<string[] | undefined> {
    if (AREA_SCOPED_ROLES.has(req.user.role as UserRole)) return undefined;
    return this.accountAccess.allowedClientIds(req.organizationId, req.user);
  }

  /**
   * Abre una solicitud.
   *
   * Cualquiera del equipo puede pedir trabajo —es el punto de tener una puerta única—, así que
   * se declara `view` sobre producción en vez de `edit`: pedir no es producir.
   */
  @Post()
  @RequiresPermission('production', 'view')
  @Roles(
    UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR,
    UserRole.CREATIVE_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.AV_DIRECTOR,
    UserRole.COMMUNITY_MANAGER, UserRole.DESIGNER, UserRole.AUDIOVISUAL, UserRole.AI_LEAD,
  )
  @ApiOperation({ summary: 'Abrir una solicitud de trabajo' })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateWorkRequestDto) {
    const allowed = await this.clientScope(req);
    return this.intake.create(req.organizationId, req.user.id, dto, allowed);
  }

  @Get()
  @RequiresPermission('production', 'view')
  @ApiOperation({ summary: 'Bandeja de solicitudes' })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: WorkRequestStatus,
    @Query('area') area?: string,
    @Query('clientId') clientId?: string,
    @Query('mine') mine?: string,
  ) {
    const allowed = await this.clientScope(req);
    return this.intake.list(
      req.organizationId,
      { status, area, clientId, mine: mine === 'true' ? req.user.id : undefined },
      allowed,
      { id: req.user.id, role: req.user.role as UserRole },
    );
  }

  @Get('counts')
  @RequiresPermission('production', 'view')
  @ApiOperation({ summary: 'Conteo de solicitudes por estado' })
  async counts(@Req() req: AuthenticatedRequest) {
    const allowed = await this.clientScope(req);
    return this.intake.counts(req.organizationId, allowed, { id: req.user.id, role: req.user.role as UserRole });
  }

  /**
   * Responsables posibles para un área.
   *
   * Va por área y no una lista sola porque cada área tiene su propia gente: el desplegable de
   * una solicitud audiovisual no debe ofrecer diseñadores.
   */
  @Get('options/assignees')
  @RequiresPermission('production', 'view')
  @ApiOperation({ summary: 'Responsables activos del área indicada' })
  async assignees(@Req() req: AuthenticatedRequest, @Query('area') area: WorkRequestArea) {
    if (!Object.values(WorkRequestArea).includes(area)) {
      throw new BadRequestException('Indica un área válida');
    }
    return this.intake.assigneeOptions(req.organizationId, area);
  }

  @Get(':id')
  @RequiresPermission('production', 'view')
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const allowed = await this.clientScope(req);
    return this.intake.findOne(req.organizationId, id, allowed);
  }

  /**
   * Asignar, priorizar y mover de estado.
   *
   * Restringido a quien coordina la producción. El plan lo dice explícitamente: **el rol de
   * asignación es de Operaciones**, y no se replica la configuración anterior donde cualquiera
   * podía tomar trabajo.
   */
  @Patch(':id')
  @RequiresPermission('production', 'manage')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.AV_DIRECTOR)
  @ApiOperation({ summary: 'Asignar responsable, prioridad o estado' })
  async update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateWorkRequestDto) {
    const allowed = await this.clientScope(req);
    return this.intake.update(req.organizationId, id, dto, allowed);
  }

  @Post(':id/convert')
  @RequiresPermission('production', 'manage')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.AV_DIRECTOR)
  @ApiOperation({ summary: 'Convertir la solicitud en piezas de produccion' })
  async convert(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ResolveWorkRequestDto) {
    const allowed = await this.clientScope(req);
    return this.intake.convert(req.organizationId, id, dto, allowed);
  }
}
