import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedRequest } from '@shared/types/request';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import { CampaignsService } from './campaigns.service';
import { SaveCampaignDto } from './dto/save-campaign.dto';

/**
 * Campañas de captación y su costo por lead.
 *
 * Sin `@Roles`: la matriz de permisos decide quién entra, igual que el resto del CRM. Ver
 * `lead.controller.ts` para el razonamiento.
 */
@ApiTags('CRM - Campañas')
@Controller('crm/campaigns')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('crm')
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Campañas con su inversión y costo por lead' })
  async list(@Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    return this.campaigns.list(req.organizationId, clientId || undefined);
  }

  /**
   * Registra la campaña y entrega su llave de entrada.
   *
   * La llave viaja **una sola vez, en esta respuesta**. En base queda su huella y no la llave,
   * así que no hay ningún sitio del que volver a leerla: si se pierde, se rota desde la
   * administración del CRM y la anterior deja de servir en el acto. Devolverla en el listado
   * sería tener la contraseña de escritura de una cuenta a un `GET` de distancia.
   */
  @Post()
  @ApiOperation({ summary: 'Registrar una campaña y emitir su llave de entrada' })
  async create(@Body() dto: SaveCampaignDto, @Req() req: AuthenticatedRequest) {
    // La cuenta llega del navegador y decide de qué empresa es el gasto: se comprueba antes de
    // escribir, como en el resto del CRM.
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId ?? undefined);
    const { campaign, token } = await this.campaigns.create(req.organizationId, dto, req.user.id);

    return {
      campaign,
      // Lo que hay que pegar en el escenario, ya armado: la cabecera es la forma correcta y
      // escribirla a mano es donde se cuela el error que después cuesta media hora encontrar.
      integracion: {
        url: '/api/public/ingest/leads',
        method: 'POST',
        header: `Authorization: Bearer ${token}`,
        token,
      },
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una campaña' })
  async update(@Param('id') id: string, @Body() dto: SaveCampaignDto, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId ?? undefined);
    return this.campaigns.update(id, req.organizationId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una campaña' })
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.campaigns.remove(id, req.organizationId);
    return { success: true };
  }
}
