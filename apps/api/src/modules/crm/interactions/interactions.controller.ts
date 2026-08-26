import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, Query, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InteractionsService } from './interactions.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { UpdateInteractionDto } from './dto/update-interaction.dto';
import { ListInteractionsDto } from './dto/list-interactions.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import { ClientCapabilityService } from '../../../core/client-scope/client-capability.service';

@Controller('crm/interactions')
@UseGuards(AuthGuard('jwt'))
// Sin `@Roles`: la matriz de permisos decide quien entra. Ver `lead.controller.ts`.
// Las interacciones se crean y leen dentro de la ficha del lead. Son parte del CRM operativo,
// no del módulo futuro de oportunidades: separarlas dejaba una ficha funcional a medias.
@ModuleScope('crm')
export class InteractionsController {
  constructor(
    private service: InteractionsService,
    private readonly accountAccess: AccountAccessService,
    private readonly capabilities: ClientCapabilityService,
  ) {}

  @Post()
  async create(@Body() dto: CreateInteractionDto, @Req() req: AuthenticatedRequest) {
    await this.assertClientScope(req, await this.service.referenceClientId(dto, req.organizationId));
    return this.service.create(dto, req.organizationId, req.user.id);
  }

  @Get()
  async findAll(@Query() query: ListInteractionsDto, @Req() req: AuthenticatedRequest) {
    // El portal toma la empresa de la sesión. El query string es controlable por el navegador y
    // no puede bloquear su propio calendario ni utilizarse para consultar la empresa vecina.
    const clientId = req.user.role === 'client' ? req.user.clientId : query.clientId;
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    await this.capabilities.assert(req.organizationId, clientId, 'crm');
    if (query.leadId) {
      await this.assertClientScope(req, await this.service.referenceClientId({ leadId: query.leadId }, req.organizationId));
    }
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.service.findAll(req.organizationId, query.limit, query.offset, query.leadId, allowed, clientId, { from: query.from, to: query.to });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const interaction = await this.service.findOne(id, req.organizationId);
    await this.assertClientScope(req, await this.service.effectiveClientId(interaction, {}, req.organizationId));
    return interaction;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateInteractionDto, @Req() req: AuthenticatedRequest) {
    const interaction = await this.service.findOne(id, req.organizationId);
    await this.assertClientScope(req, await this.service.effectiveClientId(interaction, {}, req.organizationId));
    await this.assertClientScope(req, await this.service.effectiveClientId(interaction, dto, req.organizationId));
    return this.service.update(id, dto, req.organizationId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const interaction = await this.service.findOne(id, req.organizationId);
    await this.assertClientScope(req, await this.service.effectiveClientId(interaction, {}, req.organizationId));
    return this.service.remove(id, req.organizationId);
  }

  private async assertClientScope(req: AuthenticatedRequest, clientId?: string): Promise<void> {
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    if (!clientId && allowed !== undefined) throw new NotFoundException('Interaction not found');
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    await this.capabilities.assert(req.organizationId, clientId, 'crm');
  }
}
