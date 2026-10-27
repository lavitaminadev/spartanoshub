import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './client.entity';
import { ClientsController } from './clients.controller';
import { CreateClientUseCase } from './create-client.use-case';
import { ListClientsUseCase } from './list-clients.use-case';
import { GetClientUseCase } from './get-client.use-case';
import { ClientOverviewService } from './client-overview.service';
import { User } from '../users/user.entity';
import { Lead } from '../crm/leads/lead.entity';
import { UsersModule } from '../users/users.module';
import { ConsentVersion } from '../../core/data-protection/consent-version.entity';
import { DataConsent } from '../../core/data-protection/consent.entity';
import { AuditModule } from '../../core/audit/audit.module';
import { DetalleDeContactoEnAvisosService } from './detalle-de-contacto-en-avisos';
import { ParametersModule } from '../../core/parameters/parameters.module';

@Module({
  imports: [TypeOrmModule.forFeature([Client, User, Lead, ConsentVersion, DataConsent]), ParametersModule, UsersModule, AuditModule],
  controllers: [ClientsController],
  providers: [CreateClientUseCase, ListClientsUseCase, GetClientUseCase, ClientOverviewService, DetalleDeContactoEnAvisosService],
})
export class ClientsModule {}
