import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { Reservation } from '../../../modules/reservations/domain/reservation.entity';
import { ReservationForm } from '../../../modules/reservations/domain/reservation-form.entity';
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

interface AjustesDeCupon {
  codigo: string;
  asunto: string;
  cuerpo: string;
  diasValidez: number;
}

/**
 * Envía el cupón a quien vino, cuando la empresa lo tiene encendido.
 *
 * Es el único correo que **da algo**, y por eso el único que puede costar dinero si sale mal: un
 * cupón que llega a quien no corresponde se canjea igual. De ahí las tres condiciones: nace
 * apagado, solo alcanza a quien se marcó como asistido, y no se repite a la misma persona antes
 * de dos meses.
 *
 * El código lo escribe la empresa y no lo inventa el sistema: quien lo canjea es su caja, y
 * tiene que reconocerlo. Generar uno por persona exigiría que la caja supiera validarlo, que es
 * un sistema entero que nadie pidió.
 */
@Injectable()
export class CuponPostVisitaJob {
  private readonly logger = new Logger(CuponPostVisitaJob.name);

  constructor(
    @InjectRepository(Reservation) private readonly reservas: Repository<Reservation>,
    @InjectRepository(ReservationForm) private readonly formularios: Repository<ReservationForm>,
    private readonly correo: EmailService,
    private readonly parametros: ParameterResolver,
  ) {}

  async handle(): Promise<{ enviados: number; revisados: number }> {
    const ahora = Date.now();
    const hasta = new Date(ahora - HORAS_DE_ESPERA * UNA_HORA);
    const desde = new Date(ahora - DIAS_HACIA_ATRAS * 24 * UNA_HORA);

    /*
     * Solo quien asistió de verdad.
     *
     * Una reserva confirmada que nadie marcó no es una visita: mandarle un cupón regala un
     * descuento a quien no fue, y el equipo del local lo descubre cuando alguien lo canjea.
     */
    const reservas = await this.reservas.find({
      where: {
        status: 'attended',
        endsAt: Between(desde, hasta),
        guestEmail: Not(IsNull()),
        cuponEnviadoEn: IsNull(),
      },
      take: TOPE_POR_PASADA,
      order: { endsAt: 'ASC' },
    });

    let enviados = 0;
    const formulariosPorId = new Map<string, ReservationForm | null>();
    const ajustesPorEmpresa = new Map<string, AjustesDeCupon | null>();

    for (const reserva of reservas) {
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
        if (!ajustes) continue;

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

        const vence = new Date(ahora + ajustes.diasValidez * 24 * UNA_HORA);
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

    return { enviados, revisados: reservas.length };
  }

  /**
   * Los ajustes del cupón de esa empresa, o nada si no corresponde enviarlo.
   *
   * Devuelve `null` en dos casos y los dos son deliberados: apagado, y sin código —un correo que
   * promete un cupón y llega vacío es peor que no mandarlo—.
   */
  private async ajustesDe(form: ReservationForm): Promise<AjustesDeCupon | null> {
    const leer = (clave: string) => this.parametros.get(clave, form.clientId, null, form.organizationId);
    const [encendido, codigo, asunto, cuerpo, dias] = await Promise.all([
      leer('email.coupon_enabled'),
      leer('email.coupon_code'),
      leer('email.coupon_subject'),
      leer('email.coupon_body'),
      leer('email.coupon_days_valid'),
    ]);

    if (!encendido) return null;

    const codigoLimpio = String(codigo ?? '').trim();
    if (!codigoLimpio) {
      this.logger.warn(`Cupón encendido sin código en la empresa ${form.clientId}: no se envía nada`);
      return null;
    }

    const diasValidez = Number(dias);
    return {
      codigo: codigoLimpio,
      asunto: String(asunto ?? 'Un regalo de {{local}} para ti'),
      cuerpo: String(cuerpo ?? '{{nombre}}, gracias por venir a {{local}}.\n\nTe dejamos este código: {{cupon}}\n\nMuéstralo cuando vuelvas. Válido hasta el {{vence}}.'),
      diasValidez: Number.isFinite(diasValidez) && diasValidez >= 1 && diasValidez <= 365 ? diasValidez : 30,
    };
  }
}
