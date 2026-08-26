import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrmModule } from '../crm/crm.module';
import { AccountAccessModule } from '../../core/client-scope/account-access.module';
import { Reservation } from '../reservations/domain/reservation.entity';
import { PortalHomeController } from './portal-home.controller';

/**
 * El portal de una empresa cliente.
 *
 * Vive aparte de CRM y de Reservas porque no pertenece a ninguno de los dos: su trabajo es reunir
 * lo que esa empresa tiene contratado y contarlo en una sola pantalla. Ponerlo dentro de
 * cualquiera de los módulos habría obligado a que ése supiera del otro.
 *
 * Nadie lo importa, así que no puede crear un ciclo por más que crezca.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Reservation]), CrmModule, AccountAccessModule],
  controllers: [PortalHomeController],
})
export class PortalModule {}
