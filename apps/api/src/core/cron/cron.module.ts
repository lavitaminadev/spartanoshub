import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { MetaModule } from '../../modules/integrations/meta/meta.module';
import { GoogleModule } from '../../modules/integrations/google/google.module';
import { JobsModule } from '../jobs/jobs.module';
import { AutomationsModule } from '../../modules/automations/automations.module';

@Module({
  imports: [MetaModule, GoogleModule, JobsModule, AutomationsModule],
  controllers: [CronController],
})
export class CronModule {}
