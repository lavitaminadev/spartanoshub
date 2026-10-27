import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/client.entity';
import { Vulneracion } from './vulneracion.entity';
import { VulneracionesController } from './vulneraciones.controller';
import { VulneracionesService } from './vulneraciones.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vulneracion, Client])],
  controllers: [VulneracionesController],
  providers: [VulneracionesService],
})
export class VulneracionesModule {}
