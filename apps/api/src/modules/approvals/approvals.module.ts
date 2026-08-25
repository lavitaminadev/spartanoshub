import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalRequest } from './approval-request.entity';
import { ApprovalsController } from './approvals.controller';
import { ListApprovalsUseCase } from './list-approvals.use-case';
import { UpdateApprovalStatusUseCase } from './update-approval-status.use-case';
import { Piece } from '../production/piece.entity';
import { PieceVersion } from '../production/piece-version.entity';
import { Correction } from '../production/correction.entity';
import { PieceRulesService } from '../production/piece-rules.service';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { ParametersModule } from '../../core/parameters/parameters.module';
import { ProductionModule } from '../production/production.module';
import { Lead } from '../crm/leads/lead.entity';
import { AuthorizationModule } from '../../core/authorization/authorization.module';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalRequest, Piece, PieceVersion, Correction, Client, User, Lead]), ParametersModule, ProductionModule, AuthorizationModule],
  controllers: [ApprovalsController, TasksController],
  providers: [ListApprovalsUseCase, UpdateApprovalStatusUseCase, PieceRulesService, TasksService],
  // Lo exporta para el disparador de tareas vencidas del motor de automatizaciones.
  exports: [TasksService],
})
export class ApprovalsModule {}
