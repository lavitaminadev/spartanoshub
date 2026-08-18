import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkRequest } from './work-request.entity';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { Piece } from '../production/piece.entity';
import { Session } from '../audiovisual/session.entity';
import { Moodboard } from '../audiovisual/moodboard.entity';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { DesignBudgetModule } from '../design-budget/design-budget.module';
import { ProductionModule } from '../production/production.module';
import { AccountAccessModule } from '../../core/client-scope/account-access.module';

@Module({
  imports: [TypeOrmModule.forFeature([WorkRequest, Client, User, Piece, Session, Moodboard]), AccountAccessModule, DesignBudgetModule, ProductionModule],
  controllers: [IntakeController],
  providers: [IntakeService],
  exports: [IntakeService],
})
export class IntakeModule {}
