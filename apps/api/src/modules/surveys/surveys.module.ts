import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Survey } from './survey.entity';
import { SurveyResponse } from './survey-response.entity';
import { SurveysController } from './surveys.controller';
import { PublicSurveysController } from './public-surveys.controller';
import { AccountAccessModule } from '../../core/client-scope/account-access.module';
import { EmailModule } from '../../core/notifications/email.module';
import { PublicSurveyFlowService } from './public-survey-flow.service';

@Module({
  imports: [TypeOrmModule.forFeature([Survey, SurveyResponse]), AccountAccessModule, EmailModule, AuditModule],
  controllers: [SurveysController, PublicSurveysController],
  providers: [PublicSurveyFlowService],
  exports: [PublicSurveyFlowService],
})
export class SurveysModule {}
