import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronController } from './cron.controller';
import { MarketingModule } from '../../modules/marketing/marketing.module';
import { CronRun } from './cron-run.entity';
import { MetaModule } from '../../modules/integrations/meta/meta.module';
import { GoogleModule } from '../../modules/integrations/google/google.module';
import { JobsModule } from '../jobs/jobs.module';
import { AutomationsModule } from '../../modules/automations/automations.module';

@Module({
  imports: [TypeOrmModule.forFeature([CronRun]), MetaModule, GoogleModule, JobsModule, AutomationsModule, MarketingModule],
  controllers: [CronController],
})
export class CronModule {}
