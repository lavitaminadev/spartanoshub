import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from './contract.entity';
import { ContractService } from './contract-service.entity';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Client } from '../clients/client.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, ContractService, Client])],
  controllers: [ContractsController],
  providers: [ContractsService],
  // Lo consume el motor de automatizaciones para abrir el contrato al ganar un trato. Se
  // reutiliza el servicio en vez de escribir el contrato por otra vía: las validaciones de
  // cliente y de fechas viven ahí y no deben existir dos veces.
  exports: [ContractsService],
})
export class ContractsModule {}
