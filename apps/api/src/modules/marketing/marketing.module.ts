import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Suscriptor } from './suscriptor.entity';
import { ExclusionDeCorreo } from './exclusion.entity';
import { Campana } from './campana.entity';
import { ReservationCoupon } from '../reservations/domain/reservation-coupon.entity';
import { User } from '../users/user.entity';
import { EnvioDeCampana } from './envio-de-campana.entity';
import { SuscriptoresService } from './suscriptores.service';
import { SuscriptoresController } from './suscriptores.controller';
import { CampanasService } from './campanas.service';
import { EnviosDeCampanaService } from './envios-de-campana.service';
import { CampanasController } from './campanas.controller';
import { AltaDeSuscriptorDesdeReserva } from './alta-desde-reserva';
import { AccountAccessModule } from '../../core/client-scope/account-access.module';
import { EmailModule } from '../../core/notifications/email.module';
import { ParametersModule } from '../../core/parameters/parameters.module';

/**
 * La lista de correo comercial, separada de todo lo demás.
 *
 * No cuelga del CRM ni de Reservas porque el permiso para escribir a alguien no es el mismo que
 * tenerlo como prospecto o como comensal: quien reservó dio su correo para que le confirmes la
 * mesa. Desde la pantalla se pueden mirar esos registros; acá solo entra quien puede recibir
 * campañas, con la constancia de por qué.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Suscriptor, ExclusionDeCorreo, Campana, EnvioDeCampana, ReservationCoupon, User]),
    // `AccountAccessModule` trae la capacidad por empresa: el portal sólo ve su lista si la tiene.
    AccountAccessModule,
    // Enviar campañas necesita el transporte y los interruptores del enlace de baja.
    EmailModule,
    ParametersModule,
  ],
  controllers: [SuscriptoresController, CampanasController],
  providers: [SuscriptoresService, AltaDeSuscriptorDesdeReserva, CampanasService, EnviosDeCampanaService],
  exports: [SuscriptoresService, AltaDeSuscriptorDesdeReserva, CampanasService, EnviosDeCampanaService],
})
export class MarketingModule {}
