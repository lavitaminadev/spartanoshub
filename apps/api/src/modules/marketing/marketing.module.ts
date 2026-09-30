import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Suscriptor } from './suscriptor.entity';
import { ExclusionDeCorreo } from './exclusion.entity';
import { SuscriptoresService } from './suscriptores.service';
import { SuscriptoresController } from './suscriptores.controller';
import { AltaDeSuscriptorDesdeReserva } from './alta-desde-reserva';
import { AccountAccessModule } from '../../core/client-scope/account-access.module';

/**
 * La lista de correo comercial, separada de todo lo demás.
 *
 * No cuelga del CRM ni de Reservas porque el permiso para escribir a alguien no es el mismo que
 * tenerlo como prospecto o como comensal: quien reservó dio su correo para que le confirmes la
 * mesa. Desde la pantalla se pueden mirar esos registros; acá solo entra quien puede recibir
 * campañas, con la constancia de por qué.
 */
@Module({
  // `AccountAccessModule` trae la capacidad por empresa: el portal sólo ve su lista si la tiene.
  imports: [TypeOrmModule.forFeature([Suscriptor, ExclusionDeCorreo]), AccountAccessModule],
  controllers: [SuscriptoresController],
  providers: [SuscriptoresService, AltaDeSuscriptorDesdeReserva],
  exports: [SuscriptoresService, AltaDeSuscriptorDesdeReserva],
})
export class MarketingModule {}
