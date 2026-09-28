import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { Reservation } from '../../../modules/reservations/domain/reservation.entity';
import { ReservationForm } from '../../../modules/reservations/domain/reservation-form.entity';
import { ReservationCoupon } from '../../../modules/reservations/domain/reservation-coupon.entity';
import { encuestasHabilitadas } from '../../../modules/surveys/encuestas-de-la-empresa';
import { EmailService } from '../../notifications/email.service';
import { componerCorreo } from '../../notifications/plantilla-de-correo';
import { ParameterResolver } from '../../parameters/parameter-resolver.service';

const UNA_HORA = 60 * 60 * 1000;

/** Horas tras el fin de la visita antes de enviar. Da margen a que la asistencia se marque. */
const HORAS_DE_ESPERA = 24;

/** Hasta dónde mira hacia atrás. Lo más viejo ya no interesa: un cupón tardío no invita a volver. */
const DIAS_HACIA_ATRAS = 7;

/**
 * Días entre cupones a la misma persona en el mismo local.
 *
 * Sin esto, quien viene cada semana recibe un cupón cada semana y la promoción deja de ser un
 * incentivo para volver: pasa a ser un descuento permanente que la empresa no decidió dar.
 */
const DIAS_ENTRE_CUPONES = 60;

/** Cuántas se revisan por pasada, para no bloquear la base en un local con mucho movimiento. */
const TOPE_POR_PASADA = 300;

/** Cuándo sale el cupón. */
export type DisparadorDeCupon = 'asistencia' | 'encuesta';

interface AjustesDeCupon {
  codigo: string;
  asunto: string;
  cuerpo: string;
  diasValidez: number;
  disparador: DisparadorDeCupon;
  /** Hasta cuándo vale el cupón de verdad; el correo no puede prometer más que eso. */
  vigenteHasta: Date | null;
}

/**
 * Envía el cupón a quien vino, cuando la empresa lo tiene encendido.
 *
 * Es el único correo que **da algo**, y por eso el único que puede costar dinero si sale mal: un
 * cupón que llega a quien no corresponde se canjea igual. Nace apagado, no se repite a la misma
 * persona antes de dos meses, y sale en uno de dos momentos, que elige la empresa:
 *
 * - **asistencia**: un día después de que el local marque que la persona vino;
 * - **encuesta**: cuando la persona responde la encuesta de su visita. Sólo si la empresa tiene
 *   Encuestas contratado; sin él no hay respuesta que esperar y no sale nada.
 *
 * **El código tiene que ser un cupón que exista.** Antes se escribía a mano y nadie lo
 * comprobaba: con un error de tipeo, o un cupón desactivado, vencido o de otra empresa, la
 * persona recibía un regalo que la caja después rechazaba. Ahora, si el cupón no sirve, no se
 * envía nada y queda el motivo en el registro.
 */
@Injectable()
export class CuponPostVisitaJob {
  private readonly logger = new Logger(CuponPostVisitaJob.name);

  constructor(
    @InjectRepository(Reservation) private readonly reservas: Repository<Reservation>,
    @InjectRepository(ReservationForm) private readonly formularios: Repository<ReservationForm>,
    @InjectRepository(ReservationCoupon) private readonly cupones: Repository<ReservationCoupon>,
    private readonly correo: EmailService,
    private readonly parametros: ParameterResolver,
  ) {}

  async handle(): Promise<{ enviados: number; revisados: number }> {
    const ahora = Date.now();
    const desde = new Date(ahora - DIAS_HACIA_ATRAS * 24 * UNA_HORA);

    /*
     * Dos grupos de candidatas, uno por disparador. Cada reserva se envía sólo si su empresa
     * eligió justo ese disparador: una empresa que espera la encuesta no manda el cupón por la
     * asistencia, aunque la reserva esté en los dos grupos.
     */
    const porAsistencia = await this.reservas.find({
      where: {
        // Sólo quien asistió de verdad: una reserva confirmada que nadie marcó no es una visita.
        status: 'attended',
        endsAt: Between(desde, new Date(ahora - HORAS_DE_ESPERA * UNA_HORA)),
        guestEmail: Not(IsNull()),
        cuponEnviadoEn: IsNull(),
      },
      take: TOPE_POR_PASADA,
      order: { endsAt: 'ASC' },
    });
    const porEncuesta = await this.reservasConEncuestaRespondida(desde);

    const candidatas: Array<{ reserva: Reservation; disparador: DisparadorDeCupon }> = [
      ...porAsistencia.map((reserva) => ({ reserva, disparador: 'asistencia' as const })),
      ...porEncuesta.map((reserva) => ({ reserva, disparador: 'encuesta' as const })),
    ];

    let enviados = 0;
    const yaVistas = new Set<string>();
    const formulariosPorId = new Map<string, ReservationForm | null>();
    const ajustesPorEmpresa = new Map<string, AjustesDeCupon | null>();

    for (const { reserva, disparador } of candidatas) {
      if (yaVistas.has(reserva.id)) continue;
      try {
        let form = formulariosPorId.get(reserva.formId);
        if (form === undefined) {
          form = await this.formularios.findOne({ where: { id: reserva.formId } });
          formulariosPorId.set(reserva.formId, form);
        }
        if (!form) continue;

        const clave = `${form.organizationId}:${form.clientId}`;
        let ajustes = ajustesPorEmpresa.get(clave);
        if (ajustes === undefined) {
          ajustes = await this.ajustesDe(form);
          ajustesPorEmpresa.set(clave, ajustes);
        }
        if (!ajustes || ajustes.disparador !== disparador) continue;
        yaVistas.add(reserva.id);

        const recienteParaEsaPersona = await this.reservas.count({
          where: {
            formId: reserva.formId,
            guestEmail: reserva.guestEmail as string,
            cuponEnviadoEn: MoreThan(new Date(ahora - DIAS_ENTRE_CUPONES * 24 * UNA_HORA)),
          },
        });
        // Se marca igual aunque no se envíe: si no, la misma reserva se revisa en cada pasada.
        if (recienteParaEsaPersona > 0) {
          await this.reservas.update(reserva.id, { cuponEnviadoEn: new Date() });
          continue;
        }

        // El correo no promete más plazo que el que tiene el cupón de verdad.
        const porDias = new Date(ahora + ajustes.diasValidez * 24 * UNA_HORA);
        const vence = ajustes.vigenteHasta && ajustes.vigenteHasta < porDias ? ajustes.vigenteHasta : porDias;
        const { subject, html } = componerCorreo(ajustes.asunto, ajustes.cuerpo, {
          nombre: reserva.guestName?.trim().split(/\s+/)[0] || '',
          // El local y no la agencia: quien vino no conoce a Espartanos.
          local: form.name,
          cupon: ajustes.codigo,
          vence: vence.toLocaleDateString('es-CL', { dateStyle: 'long', timeZone: form.timezone }),
        });

        const soporte = typeof (form.designConfig as Record<string, unknown>)?.supportEmail === 'string'
          ? String((form.designConfig as Record<string, unknown>).supportEmail)
          : undefined;
        const salio = await this.correo.send(
          reserva.guestEmail as string,
          subject,
          html,
          soporte ? { replyTo: soporte } : undefined,
        );
        // Solo se marca lo que salió: si el correo está apagado o falla, se reintenta.
        if (!salio) continue;
        await this.reservas.update(reserva.id, { cuponEnviadoEn: new Date() });
        enviados += 1;
      } catch (error) {
        this.logger.error(`No se pudo enviar el cupón de la reserva ${reserva.id}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return { enviados, revisados: candidatas.length };
  }

  /**
   * Reservas cuya persona respondió la encuesta de la visita en los últimos días.
   *
   * Sólo cuentan las respuestas que llegaron por la invitación de esa reserva —las que tienen
   * `reservation_id`—: una respuesta anónima por QR no dice a quién mandarle el cupón. Y sólo las
   * terminadas: dejar la nota y cerrar no es haber respondido la encuesta.
   */
  private async reservasConEncuestaRespondida(desde: Date): Promise<Reservation[]> {
    const filas = await this.reservas.query(
      `SELECT DISTINCT r.id
         FROM reservations r
         JOIN survey_responses s ON s.reservation_id = r.id
        WHERE s.completed_at IS NOT NULL
          AND s.completed_at >= ?
          AND r.guest_email IS NOT NULL
          AND r.cupon_enviado_en IS NULL
        LIMIT ${TOPE_POR_PASADA}`,
      [desde],
    ).catch(() => []) as Array<{ id: string }>;
    if (filas.length === 0) return [];
    return this.reservas.find({ where: filas.map((fila) => ({ id: fila.id })) });
  }

  /**
   * Los ajustes del cupón de esa empresa, o nada si no corresponde enviarlo.
   *
   * Devuelve `null` —y no envía— cuando está apagado, cuando no tiene código, cuando el código no
   * es un cupón activo y vigente **de esa misma empresa**, y cuando espera la encuesta pero la
   * empresa no tiene Encuestas. En los casos que parecen un error deja el motivo en el registro.
   */
  private async ajustesDe(form: ReservationForm): Promise<AjustesDeCupon | null> {
    const leer = (clave: string) => this.parametros.get(clave, form.clientId, null, form.organizationId);
    const [encendido, codigo, asunto, cuerpo, dias, momento] = await Promise.all([
      leer('email.coupon_enabled'),
      leer('email.coupon_code'),
      leer('email.coupon_subject'),
      leer('email.coupon_body'),
      leer('email.coupon_days_valid'),
      leer('email.coupon_trigger'),
    ]);

    if (!encendido) return null;

    const codigoLimpio = String(codigo ?? '').trim().toUpperCase();
    if (!codigoLimpio) {
      this.logger.warn(`Cupón encendido sin código en la empresa ${form.clientId}: no se envía nada`);
      return null;
    }

    const cupon = await this.cupones.findOne({ where: { organizationId: form.organizationId, code: codigoLimpio } });
    const ahora = new Date();
    const problema = !cupon ? 'no existe'
      : cupon.clientId !== form.clientId ? 'es de otra empresa'
        : !cupon.active ? 'está desactivado'
          : cupon.validUntil && cupon.validUntil <= ahora ? 'ya venció'
            : cupon.maxUses > 0 && cupon.usageCount >= cupon.maxUses ? 'no le quedan usos'
              : null;
    if (problema) {
      this.logger.warn(`El cupón ${codigoLimpio} de la empresa ${form.clientId} ${problema}: no se envía nada`);
      return null;
    }

    const disparador: DisparadorDeCupon = momento === 'encuesta' ? 'encuesta' : 'asistencia';
    if (disparador === 'encuesta' && !(await encuestasHabilitadas(this.reservas, form.clientId))) {
      this.logger.warn(`El cupón de la empresa ${form.clientId} espera la encuesta, pero no tiene Encuestas: no se envía nada`);
      return null;
    }

    const diasValidez = Number(dias);
    return {
      codigo: codigoLimpio,
      asunto: String(asunto ?? 'Un regalo de {{local}} para ti'),
      cuerpo: String(cuerpo ?? '{{nombre}}, gracias por venir a {{local}}.\n\nTe dejamos este código: {{cupon}}\n\nMuéstralo cuando vuelvas. Válido hasta el {{vence}}.'),
      diasValidez: Number.isFinite(diasValidez) && diasValidez >= 1 && diasValidez <= 365 ? diasValidez : 30,
      disparador,
      vigenteHasta: cupon!.validUntil ?? null,
    };
  }
}
