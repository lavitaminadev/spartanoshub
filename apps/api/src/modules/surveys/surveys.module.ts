import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Survey } from './survey.entity';
import { SurveyResponse } from './survey-response.entity';
import { SurveysController } from './surveys.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Survey, SurveyResponse])],
  controllers: [SurveysController],
})
export class SurveysModule {}
