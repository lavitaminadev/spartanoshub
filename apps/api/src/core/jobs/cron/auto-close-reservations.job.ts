import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { Reservation } from '../../../modules/reservations/domain/reservation.entity';
import { ReservationForm } from '../../../modules/reservations/domain/reservation-form.entity';
import { ReservationEvent } from '../../../modules/reservations/domain/reservation-event.entity';
import { ReservationHold } from '../../../modules/reservations/domain/reservation-hold.entity';

/** Sólo lo confirmado se da por asistido: una pendiente nunca la aprobó el local. */
const ACTIVE = ['confirmed', 'rescheduled'];

/**
 * Cierra asistencia sólo después del margen configurado. Es deliberadamente conservador:
 * una espera/lista de espera nunca se convierte en asistencia y un local puede apagarlo
 * con `designConfig.autoCloseAttendance = 'false'` (el editor lo guarda como texto).
 */
@Injectable()
export class AutoCloseReservationsJob {
  private readonly logger = new Logger(AutoCloseReservationsJob.name);

  constructor(
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    @InjectRepository(ReservationForm) private readonly forms: Repository<ReservationForm>,
    @InjectRepository(ReservationEvent) private readonly events: Repository<ReservationEvent>,
    @InjectRepository(ReservationHold) private readonly holds: Repository<ReservationHold>,
  ) {}

  async handle(): Promise<void> {
    // El estado se filtra en la consulta: filtrarlo después dejaba que 500 reservas viejas ya
    // cerradas ocuparan todo el lote y ninguna activa se cerrara nunca más.
    const candidates = await this.reservations.find({ where: { endsAt: LessThan(new Date()), status: In(ACTIVE) }, take: 500, order: { endsAt: 'ASC' } });
    let closed = 0;
    for (const item of candidates) {
      try {
        const form = await this.forms.findOne({ where: { id: item.formId } });
        const config = (form?.designConfig || {}) as Record<string, unknown>;
        if (config.autoCloseAttendance === false || config.autoCloseAttendance === 'false') continue;
        const configured = Number(config.autoCloseAfterMinutes);
        const afterMinutes = Number.isInteger(configured) && configured >= 15 && configured <= 24 * 60 ? configured : 60;
        if (item.endsAt.getTime() + afterMinutes * 60_000 > Date.now()) continue;

        const previous = item.status;
        const affected = await this.reservations.createQueryBuilder().update(Reservation)
          .set({ status: 'attended' })
          .where('id = :id AND status = :status', { id: item.id, status: previous }).execute();
        if (!affected.affected) continue;
        await this.events.save(this.events.create({
          organizationId: item.organizationId, clientId: item.clientId, reservationId: item.id,
          type: 'status_changed', fromStatus: previous, toStatus: 'attended', actorType: 'system',
          metadata: { via: 'automatic_day_close', afterMinutes },
        }));
        closed += 1;
      } catch (error) {
        this.logger.error(`No se pudo cerrar automáticamente ${item.id}: ${error instanceof Error ? error.message : error}`);
      }
    }
    if (closed) this.logger.log(`Reservas cerradas automáticamente: ${closed}`);
    await this.purgarCuposVencidos();
  }

  /**
   * Borra los cupos retenidos que ya vencieron.
   *
   * La disponibilidad ya los ignora por fecha, asi que esto no cambia lo que se ofrece: evita
   * que la tabla crezca sin limite con cada formulario abandonado a medio completar.
   */
  private async purgarCuposVencidos(): Promise<void> {
    try {
      const { affected } = await this.holds.createQueryBuilder().delete().from(ReservationHold)
        .where('expires_at < :now', { now: new Date() }).execute();
      if (affected) this.logger.log(`Cupos retenidos vencidos eliminados: ${affected}`);
    } catch (error) {
      this.logger.error(`No se pudieron purgar los cupos vencidos: ${error instanceof Error ? error.message : error}`);
    }
  }
}
