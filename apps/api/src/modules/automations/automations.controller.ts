import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Roles } from '../../core/authorization/roles.decorator';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { AutomationsService } from './automations.service';
import { SaveAutomationDto, SetAutomationActiveDto } from './dto/save-automation.dto';
import { AccountAccessService } from '../../core/client-scope/account-access.service';

/**
 * Administración de automatizaciones.
 *
 * Reservada a administración y a las direcciones comercial y de operaciones: una
 * automatización actúa sobre datos reales en nombre de una persona, así que configurarla es
 * una atribución de dirección y no de uso cotidiano.
 */
@ApiTags('Automatizaciones')
@ApiBearerAuth()
@Controller('automations')
@Roles(UserRole.ADMIN, UserRole.DEV, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
@ModuleScope('crm')
export class AutomationsController {
  constructor(
    private readonly automations: AutomationsService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Disparadores y acciones disponibles para el editor' })
  catalog() {
    return this.automations.catalog();
  }

  @Get()
  @ApiOperation({ summary: 'Listar automatizaciones' })
  list(@Req() req: AuthenticatedRequest) {
    return this.automations.list(req.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver una automatización con su flujo' })
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.automations.get(id, req.organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una automatización (nace desactivada)' })
  async create(@Body() dto: SaveAutomationDto, @Req() req: AuthenticatedRequest) {
    // La cuenta se comprueba contra las que quien configura alcanza. Sin esto, acotar una regla
    // a una cuenta ajena bastaría para hacerla actuar sobre datos que esa persona no puede ver.
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId ?? undefined);
    return this.automations.create(req.organizationId, dto, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar el flujo de una automatización' })
  async update(@Param('id') id: string, @Body() dto: SaveAutomationDto, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId ?? undefined);
    return this.automations.update(id, req.organizationId, dto);
  }

  @Post(':id/active')
  @ApiOperation({ summary: 'Activar o desactivar una automatización' })
  setActive(@Param('id') id: string, @Body() dto: SetAutomationActiveDto, @Req() req: AuthenticatedRequest) {
    return this.automations.setActive(id, req.organizationId, dto.isActive);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una automatización' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.automations.remove(id, req.organizationId);
  }

  @Get(':id/runs')
  @ApiOperation({ summary: 'Ejecuciones recientes de una automatización' })
  runs(@Param('id') id: string, @Query('limit') limit: string | undefined, @Req() req: AuthenticatedRequest) {
    return this.automations.listRuns(id, req.organizationId, limit ? Number(limit) : undefined);
  }

  @Get('runs/:runId')
  @ApiOperation({ summary: 'Detalle de una ejecución, paso a paso' })
  runDetail(@Param('runId') runId: string, @Req() req: AuthenticatedRequest) {
    return this.automations.runDetail(runId, req.organizationId);
  }
}
