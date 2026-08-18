import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { UpdateProcessTemplateDto } from './dto/update-process-template.dto';
import { ProcessTemplatesService } from './process-templates.service';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';

@ApiTags('Flujos configurables')
@ApiBearerAuth()
@Controller('process-templates')
@Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
@ModuleScope('operations')
export class ProcessTemplatesController {
  constructor(private readonly workflows: ProcessTemplatesService) {}
  @Get() @ApiOperation({ summary: 'Listar flujos operativos configurables' }) list(@Req() req: AuthenticatedRequest) { return this.workflows.list(req.organizationId); }
  @Put(':id') @ApiOperation({ summary: 'Actualizar etapas, SLA y responsables de un flujo' }) update(@Param('id') id: string, @Body() dto: UpdateProcessTemplateDto, @Req() req: AuthenticatedRequest) { return this.workflows.update(id, req.organizationId, dto); }
  @Post(':code/reset') @ApiOperation({ summary: 'Restaurar un flujo desde el Documento Maestro' }) reset(@Param('code') code: string, @Req() req: AuthenticatedRequest) { return this.workflows.reset(code, req.organizationId); }
}
