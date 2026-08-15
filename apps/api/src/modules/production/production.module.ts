import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Piece } from './piece.entity';
import { PieceVersion } from './piece-version.entity';
import { Correction } from './correction.entity';
import { ProductionController } from './production.controller';
import { AssignPieceUseCase } from './assign-piece.use-case';
import { CancelPieceUseCase } from './cancel-piece.use-case';
import { PieceTypeDefinition } from './piece-type-definition.entity';
import { PieceTypesService } from './piece-types.service';
import { AuditModule } from '../../core/audit/audit.module';
import { PieceTypesController } from './piece-types.controller';
import { SubmitVersionUseCase } from './submit-version.use-case';
import { RejectPieceUseCase } from './reject-piece.use-case';
import { DeliverPieceUseCase } from './deliver-piece.use-case';
import { ListPiecesUseCase } from './list-pieces.use-case';
import { PieceRulesService } from './piece-rules.service';
import { ProductionWorkflowService } from './production-workflow.service';
import { DesignBudgetModule } from '../design-budget/design-budget.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ApprovalRequest } from '../approvals/approval-request.entity';
import { BillingModule } from '../billing/billing.module';
import { User } from '../users/user.entity';
import { Client } from '../clients/client.entity';
import { ParametersModule } from '../../core/parameters/parameters.module';

@Module({
  imports: [TypeOrmModule.forFeature([Piece, PieceVersion, Correction, ApprovalRequest, User, Client, PieceTypeDefinition]), DesignBudgetModule, GamificationModule, BillingModule, ParametersModule, AuditModule],
  controllers: [ProductionController, PieceTypesController],
  providers: [PieceTypesService, AssignPieceUseCase, CancelPieceUseCase, SubmitVersionUseCase, RejectPieceUseCase, DeliverPieceUseCase, ListPiecesUseCase, ProductionWorkflowService, PieceRulesService],
  exports: [TypeOrmModule, PieceTypesService],
})
export class ProductionModule {}
