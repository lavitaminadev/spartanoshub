import { BadRequestException, Body, Controller, ForbiddenException, Get, Put, Req, Query, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../authorization/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { AccountAccessService } from '../client-scope/account-access.service';
import { EmailService } from '../notifications/email.service';
import { componerCorreo } from '../notifications/plantilla-de-correo';
import { MUESTRA } from './muestra-de-correo';
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
  constructor(
    private readonly settings: OrganizationSettingsService,
    private readonly accountAccess: AccountAccessService,
    private readonly correo: EmailService,
  ) {}

  /**
   * Ajustes efectivos, opcionalmente los de una empresa.
   *
   * Con empresa se ve lo que ella tenga escrito y, para lo demás, lo general. Es lo que
   * permite que una plantilla de correo sea distinta por cliente sin escribirla entera.
   *
   * **La empresa no entra acá.** Estos ajustes los administra Espartanos; `clientId` dice de
   * qué empresa se está editando la plantilla, no quién la edita.
   */
  @Get()
  @ApiOperation({ summary: 'Obtener configuración efectiva, opcionalmente de una empresa' })
  async list(@Req() request: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    const organizationId = request.organizationId || request.user.organizationId;
    await this.accountAccess.assertClient(organizationId, request.user, clientId);
    return this.settings.list(organizationId, clientId ?? null);
  }

  @Put()
  @ApiOperation({ summary: 'Actualizar y auditar configuración de la organización' })
  async update(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateOrganizationSettingsDto,
    @Query('clientId') clientId?: string,
  ) {
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
    const organizationId = request.organizationId || request.user.organizationId;
    // La misma comprobación que al leer: escribir la plantilla de una empresa exige alcanzarla.
    await this.accountAccess.assertClient(organizationId, request.user, clientId);

    return this.settings.update(
      organizationId,
      request.user.id,
      dto.values,
      clientId ?? null,
    );
  }

  /**
   * Manda una plantilla a la persona que la está editando.
   *
   * Editar un correo a ciegas y descubrir cómo quedó cuando ya le llegó a un cliente es la forma
   * más cara de corregir una errata. Con esto se ve antes: el mismo armazón, las mismas
   * variables, el mismo aspecto.
   *
   * **Va siempre al correo de quien lo pide**, nunca a una dirección escrita a mano. Un campo
   * libre acá convertiría la pantalla en un formulario para mandar correo con la marca de la
   * agencia a cualquiera.
   *
   * Las variables se rellenan con valores de muestra: la plantilla no sabe de qué lead o de qué
   * reserva se trata, y dejarlas vacías mostraría un texto con huecos que no se parece al real.
   */
  @Post('probar')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Enviarse una plantilla de correo para verla' })
  async probar(
    @Req() request: AuthenticatedRequest,
    @Body() dto: { asunto?: string; cuerpo?: string },
  ) {
    const destino = request.user.email;
    if (!destino) throw new BadRequestException('Tu usuario no tiene correo, así que no hay dónde enviarlo');

    const { subject, html } = componerCorreo(
      String(dto?.asunto ?? 'Prueba'),
      String(dto?.cuerpo ?? ''),
      MUESTRA,
    );

    const enviado = await this.correo.send(destino, `[Prueba] ${subject}`, html);
    return {
      enviado,
      destino,
      // Se dice explícitamente porque es la causa más frecuente de «no me llegó»: el aviso puede
      // estar encendido y el servidor de correo apagado.
      motivo: enviado ? null : 'El envío de correo está apagado en el servidor (SMTP_ENABLED)',
    };
  }
}
