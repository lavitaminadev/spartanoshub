import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Suscriptor } from './suscriptor.entity';
import { SuscriptoresService } from './suscriptores.service';
import { SuscriptoresController } from './suscriptores.controller';

/**
 * La lista de correo comercial, separada de todo lo demás.
 *
 * No cuelga del CRM ni de Reservas porque el permiso para escribir a alguien no es el mismo que
 * tenerlo como prospecto o como comensal: quien reservó dio su correo para que le confirmes la
 * mesa. Desde la pantalla se pueden mirar esos registros; acá solo entra quien puede recibir
 * campañas, con la constancia de por qué.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Suscriptor])],
  controllers: [SuscriptoresController],
  providers: [SuscriptoresService],
  exports: [SuscriptoresService],
})
export class MarketingModule {}
