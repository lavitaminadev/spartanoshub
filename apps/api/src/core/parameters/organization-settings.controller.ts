import { BadRequestException, Body, Controller, ForbiddenException, Get, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../authorization/roles.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { OrganizationSettingsService } from './organization-settings.service';
import { ModuleScope } from '../authorization/module-scope.decorator';
import { REQUIRED_LIFECYCLE_KEYS } from '../../modules/organizations/organization-features';
import { isModuleLifecycleVisible, moduleLifecycleSettingKey, type ModuleLifecycleStatus } from '@espartanos/shared';

@ApiTags('Configuración')
@ApiBearerAuth()
@Controller('settings')
/*
 * Dirección Comercial entra porque las plantillas de correo del CRM son suyas: el texto que
 * recibe un prospecto es comunicación comercial, y quien responde por ella tiene que poder
 * corregirla sin pedírselo a nadie. Todo cambio queda auditado igual.
 */
@Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV)
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
    const valores = dto.values ?? {};
    const touchesModuleLifecycle = Object.keys(valores).some((key) => key.startsWith('modules.lifecycle.'));
    if (touchesModuleLifecycle && request.user.role !== UserRole.DEV) {
      throw new ForbiddenException('Solo desarrollo puede cambiar el ciclo de vida de módulos.');
    }

    /*
      Hay dos módulos que no se pueden esconder, y uno de ellos es éste.

      `settings` gobierna este mismo endpoint: dejarlo en un estado no visible devuelve 403 a
      todo el mundo —incluido desarrollo— y no queda forma de deshacerlo sin entrar a la base de
      datos. Pasó en producción. `dashboard` es la pantalla de aterrizaje de todo cargo interno,
      y sin ella el inicio de sesión termina en «sin autorización».

      Se rechaza el cambio completo y no solo esa clave: guardar la mitad de lo que se pidió
      dejaría la pantalla mostrando un estado que nadie eligió.
    */
    const sinSalida = REQUIRED_LIFECYCLE_KEYS
      .filter((module) => {
        const valor = valores[moduleLifecycleSettingKey(module)];
        return typeof valor === 'string' && !isModuleLifecycleVisible(valor as ModuleLifecycleStatus);
      });

    if (sinSalida.length) {
      throw new BadRequestException(
        `No se puede esconder ${sinSalida.join(' ni ')}: son la puerta de entrada y el sitio donde se deshace este cambio. ` +
        'Déjalos en activo, piloto o mantenimiento.',
      );
    }
    return this.settings.update(
      request.organizationId || request.user.organizationId,
      request.user.id,
      dto.values,
    );
  }
}
