import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Onboarding } from './onboarding.entity';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { ProcessTemplatesModule } from '../process-templates/process-templates.module';

@Module({
  imports: [TypeOrmModule.forFeature([Onboarding, Client, User]), ProcessTemplatesModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
