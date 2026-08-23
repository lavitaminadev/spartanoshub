import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InteractionsService } from './interactions.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { UpdateInteractionDto } from './dto/update-interaction.dto';
import { ListInteractionsDto } from './dto/list-interactions.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
import { RequiresFeature } from '../../../core/authorization/requires-feature.decorator';

@Controller('crm/interactions')
@UseGuards(AuthGuard('jwt'))
// Sin `@Roles`: la matriz de permisos decide quien entra. Ver `lead.controller.ts`.
@RequiresFeature('commercialPipeline')
export class InteractionsController {
  constructor(private service: InteractionsService) {}

  @Post()
  create(@Body() dto: CreateInteractionDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.organizationId, req.user.id);
  }

  @Get()
  findAll(@Query() query: ListInteractionsDto, @Req() req: AuthenticatedRequest) {
    return this.service.findAll(req.organizationId, query.limit, query.offset, query.leadId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.findOne(id, req.organizationId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInteractionDto, @Req() req: AuthenticatedRequest) {
    return this.service.update(id, dto, req.organizationId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.remove(id, req.organizationId);
  }
}
