import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateOpportunityUseCase } from './use-cases/create-opportunity.use-case';
import { ListOpportunitiesUseCase } from './use-cases/list-opportunities.use-case';
import { GetOpportunityUseCase } from './use-cases/get-opportunity.use-case';
import { UpdateOpportunityUseCase } from './use-cases/update-opportunity.use-case';
import { RemoveOpportunityUseCase } from './use-cases/remove-opportunity.use-case';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { ListOpportunitiesDto } from './dto/list-opportunities.dto';
import { Roles } from '../../../core/authorization/roles.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { RequiresFeature } from '../../../core/authorization/requires-feature.decorator';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import { ProcessTemplatesService } from '../../process-templates/process-templates.service';
import { COMMERCIAL_PIPELINE_TEMPLATE } from '../../process-templates/process-template-defaults';

@Controller('crm/opportunities')
@UseGuards(AuthGuard('jwt'))
// Sin `@Roles`: la matriz de permisos decide quien entra. Ver `lead.controller.ts`.
@RequiresFeature('commercialPipeline')
export class OpportunitiesController {
  constructor(
    private createOpportunity: CreateOpportunityUseCase,
    private listOpportunities: ListOpportunitiesUseCase,
    private getOpportunity: GetOpportunityUseCase,
    private updateOpportunity: UpdateOpportunityUseCase,
    private removeOpportunity: RemoveOpportunityUseCase,
    private readonly accountAccess: AccountAccessService,
    private readonly processTemplates: ProcessTemplatesService,
  ) {}

  /**
   * Etapas del pipeline, en el orden en que se recorren.
   *
   * Estaban fijas en el frontend, de modo que cambiar una exigía desplegar y nada garantizaba
   * que el tablero, la tabla y los informes hablaran de las mismas. Ahora salen de la
   * plantilla de proceso, que es donde ya se configuran las etapas de los demás flujos.
   *
   * Va antes de `@Get(':id')` a propósito: declarada después, «stages» se interpretaría como
   * el identificador de una oportunidad.
   */
  @Get('stages')
  async stages(@Req() req: AuthenticatedRequest) {
    const steps = await this.processTemplates.getSteps(req.organizationId, COMMERCIAL_PIPELINE_TEMPLATE);
    return steps.map((step) => ({ key: step.key, label: step.label }));
  }

  @Post()
  create(@Body() dto: CreateOpportunityDto, @Req() req: AuthenticatedRequest) {
    return this.createOpportunity.execute(dto, req.organizationId, req.user.id);
  }

  @Get()
  async findAll(@Query() query: ListOpportunitiesDto, @Req() req: AuthenticatedRequest) {
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.listOpportunities.execute(req.organizationId, query.limit, query.offset, query.leadId, allowed);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.getOpportunity.execute(id, req.organizationId, allowed);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOpportunityDto, @Req() req: AuthenticatedRequest) {
    return this.updateOpportunity.execute(id, dto, req.organizationId, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.removeOpportunity.execute(id, req.organizationId);
  }
}
