import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../modules/users/user.entity';
import { Lead } from '../../modules/crm/leads/lead.entity';
import { AuditLog } from '../audit/audit.entity';
import { DataConsent } from './consent.entity';
import { ConsentVersion } from './consent-version.entity';
import { Contact } from '../../modules/crm/contacts/contact.entity';
import { Reservation } from '../../modules/reservations/domain/reservation.entity';
import { DataProtectionService } from './data-protection.service';
import { DataProtectionController } from './data-protection.controller';
import { ConsentController } from './consent.controller';
import { AuditModule } from '../audit/audit.module';
import { ParametersModule } from '../parameters/parameters.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Lead, AuditLog, DataConsent, ConsentVersion, Contact, Reservation]),
    AuditModule,
    // `ConsentController` publica el texto vigente moviendo `compliance.terms_version`, que es
    // lo que decide a quién se le vuelve a pedir la aceptación al entrar.
    ParametersModule,
  ],
  controllers: [DataProtectionController, ConsentController],
  providers: [DataProtectionService],
  exports: [DataProtectionService],
})
export class DataProtectionModule {}
