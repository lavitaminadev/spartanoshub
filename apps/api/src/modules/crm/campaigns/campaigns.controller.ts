import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedRequest } from '@shared/types/request';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import { Empresa } from '../../../core/client-scope/empresa.decorator';
import { AGENCIA, type AmbitoDeEmpresa } from '../../../core/client-scope/empresa-resuelta';
import { CampaignsService } from './campaigns.service';
import { SaveCampaignDto } from './dto/save-campaign.dto';
import { RequiresPermission } from '../../../core/authorization/requires-permission.decorator';
import { RequiereArea } from '../../../core/authorization/requiere-area.decorator';

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
  @RequiereArea('crm.medicion', 'ver')
  @ApiOperation({ summary: 'Campañas con su inversión y costo por lead' })
  async list(@Req() req: AuthenticatedRequest, @Empresa({ oAgencia: true }) empresa: AmbitoDeEmpresa) {
    return this.campaigns.list(req.organizationId, this.cuentaDe(empresa));
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
  @RequiereArea('crm.origenes', 'hacer')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Registrar una campaña y emitir su llave de entrada' })
  async create(@Body() dto: SaveCampaignDto, @Req() req: AuthenticatedRequest, @Empresa({ oAgencia: true }) empresa: AmbitoDeEmpresa) {
    // La empresa llega ya comprobada: si la cuenta alcanza varias y el cuerpo no dice cuál, no se
    // llega aquí, y el gasto no se anota en una que nadie eligió.
    const { campaign, token } = await this.campaigns.create(
      req.organizationId,
      { ...dto, clientId: this.cuentaDe(empresa) ?? null },
      req.user.id,
    );

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
  @RequiereArea('crm.origenes', 'hacer')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Actualizar una campaña' })
  async update(@Param('id') id: string, @Body() dto: SaveCampaignDto, @Req() req: AuthenticatedRequest) {
    const current = await this.campaigns.findOne(id, req.organizationId);
    await this.asegurarAlcance(req, current.clientId);
    // Sin empresa en el cuerpo la campaña se queda donde está; con ella, se comprueba el destino.
    const destination = dto.clientId === undefined ? current.clientId : dto.clientId;
    if (dto.clientId !== undefined) await this.asegurarAlcance(req, destination);
    return this.campaigns.update(id, req.organizationId, { ...dto, clientId: destination ?? null });
  }

  @Delete(':id')
  @RequiereArea('crm.origenes', 'hacer')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Eliminar una campaña' })
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const current = await this.campaigns.findOne(id, req.organizationId);
    await this.asegurarAlcance(req, current.clientId);
    await this.campaigns.remove(id, req.organizationId);
    return { success: true };
  }

  /** La empresa concreta, o `undefined` para el embudo de la agencia. */
  private cuentaDe(empresa: AmbitoDeEmpresa): string | undefined {
    return empresa === AGENCIA ? undefined : empresa;
  }

  /**
   * Comprueba que la cuenta alcanza la empresa de una campaña ya existente, o el embudo de la
   * agencia si no tiene empresa.
   *
   * La empresa sale de la campaña y no de la petición: una ruta por identificador no la declara.
   * Una campaña de la agencia sólo la alcanza quien no tiene límite; el 404 es opaco para no
   * confirmar que existe un embudo fuera de su cartera.
   */
  private async asegurarAlcance(req: AuthenticatedRequest, clientId: string | null | undefined): Promise<void> {
    if (!clientId) {
      const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
      if (allowed !== undefined) throw new NotFoundException('Client not found');
      return;
    }
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
  }
}
