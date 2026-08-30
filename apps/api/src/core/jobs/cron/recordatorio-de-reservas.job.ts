import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Not, Repository } from 'typeorm';
import { Reservation } from '../../../modules/reservations/domain/reservation.entity';
import { ReservationForm } from '../../../modules/reservations/domain/reservation-form.entity';
import { EmailService } from '../../notifications/email.service';
import { componerCorreo } from '../../notifications/plantilla-de-correo';
import { ParameterResolver } from '../../parameters/parameter-resolver.service';

const UNA_HORA = 3_600_000;

/** Anticipación de fábrica, igual que en el catálogo de ajustes. */
const HORAS_POR_DEFECTO = 24;

/**
 * Estados que ya no esperan a nadie.
 *
 * Recordarle su reserva a quien la canceló es el correo que hace que se dejen de leer todos los
 * demás.
 */
const CERRADAS = ['cancelled', 'no_show', 'attended', 'completed'];

/**
 * Le recuerda su reserva a quien la hizo, el día antes.
 *
 * Es la medida que más reduce las ausencias, y hasta ahora no existía: quien reservaba no recibía
 * absolutamente nada, ni al reservar ni después.
 *
 * La anticipación es un ajuste por empresa: un restaurante avisa la víspera y una consulta médica
 * con más margen. Y la plantilla también, cayendo a la general cuando esa empresa no tiene la
 * suya.
 *
 * Cada reserva se recuerda **una sola vez**. El trabajo corre cada media hora, así que sin esa
 * constancia la misma persona recibiría cuarenta y ocho copias antes de que llegara el día.
 */
@Injectable()
export class RecordatorioDeReservasJob {
  private readonly logger = new Logger(RecordatorioDeReservasJob.name);

  constructor(
    @InjectRepository(Reservation) private readonly reservas: Repository<Reservation>,
    @InjectRepository(ReservationForm) private readonly formularios: Repository<ReservationForm>,
    private readonly correo: EmailService,
    private readonly parametros: ParameterResolver,
  ) {}

  async handle(): Promise<void> {
    const ahora = new Date();

    /*
     * Lo que empieza dentro de las próximas horas y no se ha recordado.
     *
     * El límite superior es el mayor plazo configurable —una semana—, y la anticipación exacta de
     * cada empresa se comprueba después: son ajustes distintos por empresa y no caben en una sola
     * condición. El conjunto que llega acá ya es pequeño.
     */
    const candidatas = await this.reservas.find({
      where: {
        startsAt: Between(ahora, new Date(ahora.getTime() + 168 * UNA_HORA)),
        status: Not(In(CERRADAS)),
        reminderSentAt: IsNull(),
      },
      take: 500,
    });

    const ajustesPorFormulario = new Map<string, { encendido: boolean; horas: number } | null>();
    let enviados = 0;

    for (const reserva of candidatas) {
      // Una reserva con datos raros no puede impedir recordar el resto en esta misma pasada.
      try {
        if (!reserva.guestEmail) continue;

        const form = await this.formularios.findOne({ where: { id: reserva.formId } });
        if (!form) continue;

        let ajustes = ajustesPorFormulario.get(form.id);
        if (ajustes === undefined) {
          ajustes = await this.ajustesDe(form);
          ajustesPorFormulario.set(form.id, ajustes);
        }
        if (!ajustes?.encendido) continue;

        const faltan = (reserva.startsAt.getTime() - ahora.getTime()) / UNA_HORA;
        if (faltan > ajustes.horas) continue;

        await this.enviar(form, reserva);

        // Después de enviar: si el guardado fallara, el recordatorio se repetiría en la siguiente
        // pasada, que es preferible a marcarlo como enviado sin haberlo mandado.
        await this.reservas.update(reserva.id, { reminderSentAt: new Date() });
        enviados += 1;
      } catch (error) {
        this.logger.error(
          `No se pudo recordar la reserva ${reserva.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    this.logger.log(`Recordatorios de reserva enviados: ${enviados} de ${candidatas.length} revisadas`);
  }

  /** Si esa empresa manda recordatorios, y con cuánta anticipación. */
  private async ajustesDe(form: ReservationForm): Promise<{ encendido: boolean; horas: number }> {
    const [encendido, horas] = await Promise.all([
      this.parametros.get('email.reservation_reminder_enabled', form.clientId, null, form.organizationId),
      this.parametros.get('email.reservation_reminder_hours', form.clientId, null, form.organizationId),
    ]);
    return {
      encendido: Boolean(encendido),
      horas: Number(horas ?? HORAS_POR_DEFECTO),
    };
  }

  private async enviar(form: ReservationForm, reserva: Reservation): Promise<void> {
    const [asunto, cuerpo] = await Promise.all([
      this.parametros.get('email.reservation_reminder_subject', form.clientId, null, form.organizationId),
      this.parametros.get('email.reservation_reminder_body', form.clientId, null, form.organizationId),
    ]);

    const { subject, html } = componerCorreo(
      String(asunto ?? 'Mañana te esperamos en {{local}}'),
      String(cuerpo ?? 'Te recordamos tu reserva en {{local}} el {{fecha}}.'),
      {
        nombre: reserva.guestName,
        // El nombre del local y no el de la agencia: quien reservó no conoce a Espartanos, y un
        // recordatorio de un desconocido se lee como spam.
        local: form.name,
        fecha: reserva.startsAt.toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short' }),
        personas: reserva.partySize,
        codigo: reserva.referenceCode,
      },
    );

    await this.correo.send(reserva.guestEmail as string, subject, html);
  }
}
