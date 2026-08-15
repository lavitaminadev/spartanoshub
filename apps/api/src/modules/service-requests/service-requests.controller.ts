import { Body, Controller, Get, Param, Post, Put, Query, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { isOrganizationModuleVisible } from '@espartanos/shared';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequiresPermission } from '../../core/authorization/requires-permission.decorator';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';
import { Public } from '../../core/auth/decorators/public.decorator';
import { ServiceRequestsService } from './service-requests.service';
import { CreateServiceRequestDto, UpdateServiceRequestDto } from './dto/service-request.dto';
import type { AuthenticatedRequest } from '../../shared/types/request';

/**
 * Canal de ejercicio de derechos sobre datos personales.
 *
 * Convive con dos audiencias en el mismo controlador: el titular de los datos, que entra sin
 * cuenta desde la página pública, y Seguridad, que resuelve desde el panel. Por eso el módulo
 * se declara a nivel de clase —para que el panel quede gobernado por permisos— y los dos
 * extremos públicos se marcan uno a uno: `@Public()` es la única excepción explícita a la
 * autenticación por defecto, y marcarla por método evita abrir el panel junto con ella.
 */
@ApiTags('Solicitudes')
@Controller('service-requests')
@ModuleScope('governance')
export class ServiceRequestsController {
  constructor(private readonly service: ServiceRequestsService) {}

  /**
   * El canal público se abre y se cierra con el módulo.
   *
   * `@Public()` salta el control de módulo por completo, así que sin esta comprobación el
   * formulario quedaría recibiendo solicitudes mientras el panel que las resuelve sigue
   * cerrado. Recibir una solicitud de derechos inicia un plazo de respuesta: aceptar una que
   * nadie puede leer es peor que no ofrecer el canal, porque compromete sin poder cumplir.
   *
   * Un solo interruptor gobierna los dos extremos.
   */
  private assertCanalDisponible(): void {
    if (isOrganizationModuleVisible('governance')) return;
    throw new ServiceUnavailableException(
      'El canal de solicitudes no está disponible por ahora. Escribe a la agencia para ejercer tus derechos sobre datos personales.',
    );
  }

  /**
   * Organización a la que pertenece una solicitud pública.
   *
   * Es siempre la propia agencia, tomada del entorno: **un endpoint público jamás decide en qué
   * organización escribe**, y el titular no tiene por qué saber que existen.
   *
   * Sin este valor la solicitud quedaba con la organización vacía, y como todas las consultas de
   * administración filtran por organización, nadie podía verla. Se recibía el ejercicio de un
   * derecho y desaparecía.
   */
  private agencyOrganizationId(): string {
    const id = process.env.AGENCY_ORGANIZATION_ID;
    if (!id) {
      throw new ServiceUnavailableException(
        'El canal de solicitudes no está configurado. Escribe a la agencia para ejercer tus derechos sobre datos personales.',
      );
    }
    return id;
  }

  /**
   * Aviso de privacidad vigente, para mostrarlo antes de pedir la aceptación.
   *
   * Es público porque quien lo tiene que leer no tiene cuenta. Solo entrega el texto: no revela
   * nada de la organización ni de otras solicitudes.
   */
  @Public()
  @Get('privacy')
  async privacy() {
    this.assertCanalDisponible();
    return this.service.avisoPrivacidad(this.agencyOrganizationId());
  }

  /** Crea una solicitud desde la página pública (login → "Solicitudes"). */
  @Public()
  @Post()
  async create(@Body() dto: CreateServiceRequestDto) {
    this.assertCanalDisponible();
    if (dto.website) return { id: 'spam', status: 'ignored' };
    return this.service.createPublic({
      type: dto.type,
      requesterName: dto.requesterName,
      requesterEmail: dto.requesterEmail,
      requesterRut: dto.requesterRut,
      requesterPhone: dto.requesterPhone,
      message: dto.message,
      privacyAccepted: dto.privacyAccepted,
      organizationId: this.agencyOrganizationId(),
    });
  }

  /**
   * Consulta pública del estado, por el código que recibió el solicitante.
   *
   * Antes se consultaba por correo o RUT. Ambos son datos que un tercero puede conocer o
   * deducir —el RUT chileno tiene dígito verificador calculable—, así que servían de
   * contraseña para leer solicitudes ajenas sobre datos personales, y además viajaban en la
   * URL, que queda escrita en los registros del servidor.
   *
   * El código es el identificador de la propia solicitud: no se puede adivinar, ya está en
   * manos de quien la envió, y no es un dato personal.
   */
  @Public()
  @Get('status')
  status(@Query('ref') ref: string) {
    this.assertCanalDisponible();
    return this.service.findByReference(ref ?? '');
  }

  /** Panel de administración: lista de solicitudes. */
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @RequiresPermission('governance', 'view')
  @Get()
  list(@Req() req: AuthenticatedRequest, @Query('status') status?: string, @Query('type') type?: string) {
    return this.service.list(req.organizationId!, { status, type });
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @RequiresPermission('governance', 'view')
  @Get(':id')
  getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.getOne(req.organizationId!, id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @RequiresPermission('governance', 'edit')
  @Put(':id')
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateServiceRequestDto) {
    return this.service.update(req.organizationId!, id, { id: req.user.id, name: req.user.name }, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @RequiresPermission('governance', 'manage')
  @Post(':id/anonymize')
  anonymize(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.anonymizeByIdentity(req.organizationId!, id, { id: req.user.id, name: req.user.name });
  }
}
