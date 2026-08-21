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

  @Post()
  @ApiOperation({ summary: 'Registrar una campaña' })
  async create(@Body() dto: SaveCampaignDto, @Req() req: AuthenticatedRequest) {
    // La cuenta llega del navegador y decide de qué empresa es el gasto: se comprueba antes de
    // escribir, como en el resto del CRM.
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId ?? undefined);
    return this.campaigns.create(req.organizationId, dto);
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
