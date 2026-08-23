import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Survey } from './survey.entity';
import { SurveyResponse } from './survey-response.entity';
import { SurveysController } from './surveys.controller';
import { PublicSurveysController } from './public-surveys.controller';
import { AccountAccessModule } from '../../core/client-scope/account-access.module';

@Module({
  imports: [TypeOrmModule.forFeature([Survey, SurveyResponse]), AccountAccessModule],
  controllers: [SurveysController, PublicSurveysController],
})
export class SurveysModule {}
