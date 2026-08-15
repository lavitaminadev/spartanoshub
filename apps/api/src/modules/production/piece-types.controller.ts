import { Body, Controller, Get, Param, Post, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PieceTypesService } from './piece-types.service';
import { PieceTypeArea } from './piece-type-definition.entity';
import { CreatePieceTypeDto, UpdatePieceTypeDto } from './dto/piece-type.dto';
import { RequiresFeature } from '../../core/authorization/requires-feature.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';

/**
 * Catálogo de tipos de pieza.
 *
 * El listado queda abierto a todo el equipo porque un formulario necesita saber qué se puede
 * pedir. Proponer, aprobar y retirar sí están acotados, y quién aprueba se configura en
 * `production.piece_type_approver_role` en vez de estar fijo en el código: la atribución puede
 * cambiar de cargo sin que eso sea un cambio de programa.
 */
@ApiTags('Produccion')
@Controller('production/piece-types')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@RequiresFeature('production')
export class PieceTypesController {
  constructor(private readonly service: PieceTypesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar tipos de pieza disponibles' })
  list(
    @Query('area') area: PieceTypeArea,
    @Query('includeInactive') includeInactive: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.list(req.organizationId, { role: req.user.role as UserRole }, {
      area: area || undefined,
      includeInactive: includeInactive === 'true',
    });
  }

  /** Si quien consulta puede aprobar, para que la vista muestre o esconda esas acciones. */
  @Get('can-approve')
  @ApiOperation({ summary: 'Indicar si el cargo puede aprobar tipos de pieza' })
  async canApprove(@Req() req: AuthenticatedRequest) {
    return { canApprove: await this.service.canApprove(req.organizationId, req.user.role as UserRole) };
  }

  @Post()
  @ApiOperation({ summary: 'Proponer un tipo de pieza nuevo' })
  propose(@Body() dto: CreatePieceTypeDto, @Req() req: AuthenticatedRequest) {
    return this.service.propose(req.organizationId, dto, req.user.id, req.user.role as UserRole);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Aprobar un tipo de pieza y ponerlo en circulacion' })
  approve(@Param('id') id: string, @Body() dto: UpdatePieceTypeDto, @Req() req: AuthenticatedRequest) {
    return this.service.approve(req.organizationId, id, req.user.role as UserRole, req.user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Corregir un tipo de pieza del catalogo' })
  update(@Param('id') id: string, @Body() dto: UpdatePieceTypeDto, @Req() req: AuthenticatedRequest) {
    return this.service.update(req.organizationId, id, req.user.role as UserRole, dto);
  }

  @Post(':id/retire')
  @ApiOperation({ summary: 'Retirar un tipo de pieza de circulacion' })
  retire(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req: AuthenticatedRequest) {
    return this.service.retire(req.organizationId, id, req.user.role as UserRole, body?.reason);
  }
}
