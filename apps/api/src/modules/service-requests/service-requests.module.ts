import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceRequest } from './service-request.entity';
import { ServiceRequestsService } from './service-requests.service';
import { ServiceRequestsController } from './service-requests.controller';
import { DataProtectionModule } from '../../core/data-protection/data-protection.module';
import { AuditModule } from '../../core/audit/audit.module';
import { User } from '../users/user.entity';
import { Lead } from '../crm/leads/lead.entity';
import { Contact } from '../crm/contacts/contact.entity';
import { Reservation } from '../reservations/domain/reservation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceRequest, User, Lead, Contact, Reservation]),
    DataProtectionModule,
    AuditModule,
  ],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
