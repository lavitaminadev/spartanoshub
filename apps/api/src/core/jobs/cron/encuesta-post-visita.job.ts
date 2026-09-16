import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { encuestasHabilitadas } from '../../../modules/surveys/encuestas-de-la-empresa';
import { Reservation } from '../../../modules/reservations/domain/reservation.entity';
import { ReservationForm } from '../../../modules/reservations/domain/reservation-form.entity';
import { Survey } from '../../../modules/surveys/survey.entity';
import { crearInvitacion } from '../../../modules/surveys/invitacion-a-encuesta';
import { EmailService } from '../../notifications/email.service';
import { componerCorreo } from '../../notifications/plantilla-de-correo';
import { ParameterResolver } from '../../parameters/parameter-resolver.service';

const UNA_HORA = 3_600_000;
/** Días mínimos entre dos encuestas a la misma persona en el mismo local. */
const DIAS_ENTRE_ENCUESTAS = 7;

/** Horas después de la visita, de fábrica: con la experiencia fresca y ya en casa. */
export const HORAS_POST_VISITA_POR_DEFECTO = 3;

/**
 * Cuánto después de su momento todavía tiene sentido enviarla.
 *
 * Sin este margen, encender el aviso por primera vez encuestaría de golpe a todas las visitas de
 * las últimas semanas: correos sobre una cena de hace un mes, que se leen como spam y bajan la
 * reputación del remitente para todos los demás avisos.
 */
export const MARGEN_MAXIMO_HORAS = 48;

/**
 * Le pide su opinión a quien vino, unas horas después de la visita.
 *
 * Sólo a reservas **marcadas como asistidas**: preguntarle cómo le fue a quien no llegó, o a quien
 * canceló, es el correo que hace que se dejen de abrir todos los demás. Y sólo una vez por visita.
 *
 * La encuesta que se envía la elige cada empresa en el panel de correos. Sin encuesta elegida, o
 * con una que ya no está activa, no se envía nada: un enlace a una encuesta cerrada es peor que
 * no preguntar.
 */
@Injectable()
export class EncuestaPostVisitaJob {
  private readonly logger = new Logger(EncuestaPostVisitaJob.name);

  constructor(
    @InjectRepository(Reservation) private readonly reservas: Repository<Reservation>,
    @InjectRepository(ReservationForm) private readonly formularios: Repository<ReservationForm>,
    @InjectRepository(Survey) private readonly encuestas: Repository<Survey>,
    private readonly correo: EmailService,
    private readonly parametros: ParameterResolver,
  ) {}

  async handle(): Promise<{ enviados: number; revisados: number }> {
    const ahora = Date.now();
    const secreto = process.env.JWT_SECRET || '';
    const origen = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
    if (!secreto || !origen) {
      this.logger.warn('Encuesta post-visita omitida: falta JWT_SECRET o APP_PUBLIC_URL para armar el enlace');
      return { enviados: 0, revisados: 0 };
    }

    // El margen más amplio posible; la ventana exacta de cada empresa se comprueba después.
    const candidatas = await this.reservas.find({
      where: {
        status: 'attended',
        postVisitSurveySentAt: IsNull(),
        guestEmail: Not(IsNull()),
        endsAt: Between(new Date(ahora - (72 + MARGEN_MAXIMO_HORAS) * UNA_HORA), new Date(ahora)),
      },
      take: 500,
    });

    const ajustesPorEmpresa = new Map<string, Ajustes | null>();
    const encuestasPorId = new Map<string, Survey | null>();
    let enviados = 0;

    for (const reserva of candidatas) {
      // Una reserva con datos raros no puede impedir encuestar al resto en esta pasada.
      try {
        const form = await this.formularios.findOne({ where: { id: reserva.formId } });
        if (!form) continue;

        const clave = `${form.organizationId}:${form.clientId}`;
        let ajustes = ajustesPorEmpresa.get(clave);
        if (ajustes === undefined) {
          ajustes = await this.ajustesDe(form);
          ajustesPorEmpresa.set(clave, ajustes);
        }
        if (!ajustes) continue;

        const desde = reserva.endsAt.getTime() + ajustes.horas * UNA_HORA;
        if (ahora < desde) continue;
        // Pasó su momento: no se envía. No hace falta marcarla, porque la búsqueda deja de
        // encontrarla sola cuando su fin de visita sale de la ventana.
        if (ahora > desde + MARGEN_MAXIMO_HORAS * UNA_HORA) continue;

        let encuesta = encuestasPorId.get(ajustes.surveyId);
        if (encuesta === undefined) {
          encuesta = await this.encuestas.findOne({ where: { id: ajustes.surveyId } });
          encuestasPorId.set(ajustes.surveyId, encuesta);
        }
        if (!encuesta || !encuestaUtil(encuesta, form)) continue;
        if (!(await encuestasHabilitadas(this.reservas, form.clientId))) continue;

        // Quien viene seguido no recibe una encuesta por visita: con una por semana por local basta.
        // La visita se marca igual para no volver a revisarla en cada pasada.
        const encuestadaHacePoco = await this.reservas.count({ where: { formId: reserva.formId, guestEmail: reserva.guestEmail as string, postVisitSurveySentAt: MoreThan(new Date(ahora - DIAS_ENTRE_ENCUESTAS * 24 * UNA_HORA)) } });
        if (encuestadaHacePoco > 0) { await this.reservas.update(reserva.id, { postVisitSurveySentAt: new Date() }); continue; }

        const enlace = `${origen}/survey/${encodeURIComponent(encuesta.id)}?src=email&i=${encodeURIComponent(crearInvitacion(encuesta.id, reserva.id, secreto))}`;
        const { subject, html } = componerCorreo(
          ajustes.asunto,
          ajustes.cuerpo,
          {
            nombre: reserva.guestName?.trim().split(/\s+/)[0] || '',
            // El local y no la agencia: quien vino no conoce a Espartanos.
            local: form.name,
            fecha: reserva.startsAt.toLocaleDateString('es-CL', { dateStyle: 'long', timeZone: form.timezone }),
          },
          { texto: 'Contar cómo nos fue', url: enlace },
        );

        const soporte = typeof (form.designConfig as Record<string, unknown>)?.supportEmail === 'string'
          ? String((form.designConfig as Record<string, unknown>).supportEmail) : undefined;
        const salio = await this.correo.send(reserva.guestEmail as string, subject, html, soporte ? { replyTo: soporte } : undefined);
        // Sólo se marca lo que salió: si el correo está apagado o falla, se reintenta en la
        // siguiente pasada dentro de su margen.
        if (!salio) continue;
        await this.reservas.update(reserva.id, { postVisitSurveySentAt: new Date() });
        enviados += 1;
      } catch (error) {
        this.logger.error(`No se pudo encuestar la reserva ${reserva.id}: ${error instanceof Error ? error.message : error}`);
      }
    }

    this.logger.log(`Encuestas post-visita enviadas: ${enviados} de ${candidatas.length} revisadas`);
    return { enviados, revisados: candidatas.length };
  }

  /**
   * Si esa sucursal encuesta, con qué encuesta y cuándo. `null` si no corresponde enviar.
   *
   * **La encuesta la elige la sucursal**, y si no eligió ninguna hereda la de su empresa. Dos
   * locales de la misma empresa suelen querer preguntar cosas distintas, y con una sola elección
   * por empresa eso obligaba a conformarse con la misma para todos. El texto del correo sigue
   * siendo común: lo que cambia es a qué encuesta lleva.
   */
  private async ajustesDe(form: ReservationForm): Promise<Ajustes | null> {
    const leer = (clave: string) => this.parametros.get(clave, form.clientId, null, form.organizationId);
    const deLaSucursal = typeof (form.designConfig as Record<string, unknown>)?.encuestaPostVisita === 'string'
      ? String((form.designConfig as Record<string, unknown>).encuestaPostVisita).trim()
      : '';
    const [encendido, surveyId, horas, asunto, cuerpo] = await Promise.all([
      leer('email.post_visit_survey_enabled'),
      leer('email.post_visit_survey_id'),
      leer('email.post_visit_survey_hours'),
      leer('email.post_visit_survey_subject'),
      leer('email.post_visit_survey_body'),
    ]);
    const elegida = deLaSucursal || (typeof surveyId === 'string' ? surveyId.trim() : '');
    if (!encendido || !elegida) return null;
    const horasValidas = Number(horas);
    return {
      surveyId: elegida,
      horas: Number.isFinite(horasValidas) && horasValidas >= 1 && horasValidas <= 72 ? horasValidas : HORAS_POST_VISITA_POR_DEFECTO,
      asunto: String(asunto ?? '¿Cómo te fue en {{local}}?'),
      cuerpo: String(cuerpo ?? 'Hola {{nombre}}:\n\nGracias por venir a {{local}}. ¿Nos cuentas cómo te fue? Es un minuto.'),
    };
  }
}

interface Ajustes { surveyId: string; horas: number; asunto: string; cuerpo: string }

/**
 * Si la encuesta elegida sirve para esta visita.
 *
 * Tiene que estar activa y ser de clientes. Y si pertenece a una empresa, a la misma de la
 * reserva: una encuesta de otra empresa pondría las respuestas de estos clientes en resultados
 * que no son suyos.
 */
export function encuestaUtil(encuesta: Pick<Survey, 'status' | 'type' | 'clientId'>, form: Pick<ReservationForm, 'clientId'>): boolean {
  if (encuesta.status !== 'active' || encuesta.type !== 'customer') return false;
  return !encuesta.clientId || encuesta.clientId === form.clientId;
}
