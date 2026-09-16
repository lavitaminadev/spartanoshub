import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParameterDefinition } from './parameter-definition.entity';
import { ParameterValue } from './parameter-value.entity';
import { ParameterResolver } from './parameter-resolver.service';
import { AuditModule } from '../audit/audit.module';
import { OrganizationSettingsController } from './organization-settings.controller';
import { PaquetesDeCorreo } from './paquetes-de-correo';
import { CronRun } from '../cron/cron-run.entity';
import { OrganizationSettingsService } from './organization-settings.service';
import { EmailModule } from '../notifications/email.module';
import { User } from '../../modules/users/user.entity';
@Module({
  imports: [TypeOrmModule.forFeature([ParameterDefinition, ParameterValue, User, CronRun]), AuditModule, EmailModule],
  controllers: [OrganizationSettingsController],
  providers: [ParameterResolver, OrganizationSettingsService, PaquetesDeCorreo],
  exports: [ParameterResolver, OrganizationSettingsService, PaquetesDeCorreo, TypeOrmModule],
})
export class ParametersModule {}
