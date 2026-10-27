import { Controller, Post, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetOrCreateBudgetUseCase } from './get-or-create-budget.use-case';
import { ReserveUdUseCase } from './reserve-ud.use-case';
import { ConfirmUdConsumptionUseCase } from './confirm-ud-consumption.use-case';
import { GetOrCreateBudgetDto } from './dto/get-or-create-budget.dto';
import { ReserveUdDto } from './dto/reserve-ud.dto';
import { ConfirmUdDto } from './dto/confirm-ud.dto';
import { AjustarPresupuestoDto } from './dto/ajustar-presupuesto.dto';
import { AjustarPresupuestoUseCase } from './ajustar-presupuesto.use-case';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';
import { RequiereArea } from '../../core/authorization/requiere-area.decorator';

@ApiTags('Presupuesto UD')
@Controller('design-budget')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('udBudget')
export class DesignBudgetController {
  constructor(
    private getOrCreate: GetOrCreateBudgetUseCase,
    private reserve: ReserveUdUseCase,
    private confirm: ConfirmUdConsumptionUseCase,
    private ajustar: AjustarPresupuestoUseCase,
    private readonly accountAccess: AccountAccessService,
  ) {}

  @Post('budget')
  @RequiereArea('production.presupuesto', 'ver')
  @Roles(UserRole.OPERATIONS_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Obtener o crear presupuesto UD del mes' })
  async getOrCreateBudget(@Body() dto: GetOrCreateBudgetDto, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    return this.getOrCreate.execute(req.organizationId, dto.clientId, dto.year, dto.month, dto.defaultBudget);
  }

  /**
   * Cambiar lo contratado de un mes, con su motivo.
   *
   * Era el hueco del módulo: el trabajo mensual abre el presupuesto con el contrato base y nadie
   * podía moverlo después, de modo que un mes con diez UD vendidas de más había que tocarlo en la
   * base a mano. Pide `manage` y no `edit`: cambia cuánto se le debe a la agencia, no cómo va una
   * pieza.
   */
  @Patch('budget')
  @RequiereArea('production.ajustar_presupuesto', 'hacer')
  @Roles(UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Ajustar las UD contratadas de un mes' })
  async ajustarPresupuesto(@Body() dto: AjustarPresupuestoDto, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    return this.ajustar.execute(
      req.organizationId, dto.clientId, dto.year, dto.month, dto.contratadas, dto.motivo.trim(), req.user.id,
    );
  }

  @Post('reserve')
  @RequiereArea('production.asignar', 'hacer')
  @Roles(UserRole.ART_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reservar UDs para una pieza' })
  async reserveUd(@Body() dto: ReserveUdDto, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    return this.reserve.execute(req.organizationId, dto.clientId, dto.pieceId, dto.amount, dto.year, dto.month);
  }

  @Post('confirm')
  @RequiereArea('production.entregar', 'hacer')
  @Roles(UserRole.ART_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Confirmar consumo de UDs' })
  async confirmUd(@Body() dto: ConfirmUdDto, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    return this.confirm.execute(req.organizationId, dto.clientId, dto.pieceId, dto.year, dto.month);
  }
}
