import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';
import { Roles } from '../../core/authorization/roles.decorator';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { UserRole } from '../organizations/user-role.enum';
import { ActualizarVulneracionDto, CrearVulneracionDto } from './dto/vulneracion.dto';
import { VulneracionesService } from './vulneraciones.service';

/** Libro de registro de vulneraciones de seguridad. Forma parte de Seguridad y privacidad. */
@ApiTags('Vulneraciones')
@Controller('vulneraciones')
@ModuleScope('settings')
@Roles(UserRole.ADMIN, UserRole.DEV)
export class VulneracionesController {
  constructor(private readonly service: VulneracionesService) {}

  @Get()
  listar(@Req() req: AuthenticatedRequest) {
    return this.service.listar(req.organizationId);
  }

  @Post()
  crear(@Req() req: AuthenticatedRequest, @Body() dto: CrearVulneracionDto) {
    return this.service.crear(req.organizationId, req.user.id, dto);
  }

  @Patch(':id')
  actualizar(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarVulneracionDto) {
    return this.service.actualizar(req.organizationId, id, dto);
  }
}
