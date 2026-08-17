import { Body, Controller, ForbiddenException, Get, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../authorization/roles.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { OrganizationSettingsService } from './organization-settings.service';
import { ModuleScope } from '../authorization/module-scope.decorator';

@ApiTags('Configuración')
@ApiBearerAuth()
@Controller('settings')
@Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.DEV)
@ModuleScope('settings')
export class OrganizationSettingsController {
  constructor(private readonly settings: OrganizationSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener configuración efectiva de la organización' })
  list(@Req() request: AuthenticatedRequest) {
    return this.settings.list(request.organizationId || request.user.organizationId);
  }

  @Put()
  @ApiOperation({ summary: 'Actualizar y auditar configuración de la organización' })
  update(@Req() request: AuthenticatedRequest, @Body() dto: UpdateOrganizationSettingsDto) {
    const touchesModuleLifecycle = Object.keys(dto.values ?? {}).some((key) => key.startsWith('modules.lifecycle.'));
    if (touchesModuleLifecycle && request.user.role !== UserRole.DEV) {
      throw new ForbiddenException('Solo desarrollo puede cambiar el ciclo de vida de módulos.');
    }
    return this.settings.update(
      request.organizationId || request.user.organizationId,
      request.user.id,
      dto.values,
    );
  }
}
