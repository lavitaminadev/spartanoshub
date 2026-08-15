import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UDBudget } from './ud-budget.entity';
import { UDMovement } from './ud-movement.entity';
import { DesignBudgetController } from './design-budget.controller';
import { GetOrCreateBudgetUseCase } from './get-or-create-budget.use-case';
import { ReserveUdUseCase } from './reserve-ud.use-case';
import { ConfirmUdConsumptionUseCase } from './confirm-ud-consumption.use-case';
import { DesignBudgetService } from './design-budget.service';
import { UdValuesService } from './ud-values.service';
import { ParametersModule } from '../../core/parameters/parameters.module';
import { Piece } from '../production/piece.entity';
import { PieceTypeDefinition } from '../production/piece-type-definition.entity';
import { Client } from '../clients/client.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UDBudget, UDMovement, Piece, Client, PieceTypeDefinition]), ParametersModule],
  controllers: [DesignBudgetController],
  providers: [GetOrCreateBudgetUseCase, ReserveUdUseCase, ConfirmUdConsumptionUseCase, DesignBudgetService, UdValuesService],
  exports: [DesignBudgetService, UdValuesService],
})
export class DesignBudgetModule {}
