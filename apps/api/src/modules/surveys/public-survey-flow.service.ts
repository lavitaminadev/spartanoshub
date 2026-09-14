import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { Survey } from './survey.entity';
import { SurveyResponse } from './survey-response.entity';
import { leerInvitacion } from './invitacion-a-encuesta';
import {
  LARGO_MAXIMO_MENSAJE, notaValida, obligatoriasPendientes, preguntaDeNota, siguientePaso, unirRespuestas, type SiguientePaso,
} from './flujo-de-encuesta';
import { EmailService } from '../../core/notifications/email.service';
import { armazonDeCorreo } from '../../core/notifications/plantilla-de-correo';

/** Lo que recibe la página después de dejar la nota. */
export interface RespuestaIniciada {
  responseId: string;
  /** Permite completar esta respuesta. Viaja una sola vez; el servidor guarda sólo su hash. */
  token: string;
  rating: number;
  siguiente: SiguientePaso;
  /** Disponible siempre, también con nota baja: ver la nota sobre reseñas en `flujo-de-encuesta`. */
  reviewUrl: string | null;
  /** Nombre de pila, si la invitación vino de una reserva. Para saludar, nada más. */
  nombre: string | null;
}

function hashDelToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Una dirección de reseña que se puede entregar a la página.
 *
 * La escribe el equipo, pero termina como destino de un botón en una página pública: sólo http(s),
 * para que nunca pueda ser `javascript:` ni un esquema que el navegador ejecute.
 */
function urlDeResena(valor: string): string | null {
  try {
    const url = new URL(valor.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function secretoDeInvitaciones(): string {
  return process.env.JWT_SECRET || '';
}

/**
 * La encuesta pública respondida por pasos: nota, después mensaje o preguntas.
 *
 * Vive aparte del controlador porque son dos escrituras sobre la misma respuesta con reglas
 * distintas —crear con la nota, completar con lo demás— y cada una tiene su forma de fallar que
 * vale la pena probar sola.
 */
@Injectable()
export class PublicSurveyFlowService {
  private readonly logger = new Logger(PublicSurveyFlowService.name);

  constructor(
    @InjectRepository(Survey) private readonly surveys: Repository<Survey>,
    @InjectRepository(SurveyResponse) private readonly responses: Repository<SurveyResponse>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly correo: EmailService,
  ) {}

  private async activa(surveyId: string): Promise<Survey> {
    const survey = await this.surveys.findOne({ where: { id: surveyId } });
    if (!survey || survey.status !== 'active') throw new NotFoundException('La encuesta no está disponible');
    return survey;
  }

  /**
   * Quién está respondiendo, si llegó por la invitación de una reserva.
   *
   * La reserva tiene que ser de la misma organización —y de la misma empresa, si la encuesta tiene
   * una— que la encuesta. Una invitación firmada pero cruzada entre empresas no atribuye nada:
   * sería la forma de ver el nombre de un cliente ajeno en los resultados propios.
   */
  private async quienResponde(survey: Survey, invitacion?: string): Promise<{ reservationId: string; nombre: string | null; correo: string | null } | null> {
    const leida = leerInvitacion(invitacion, survey.id, secretoDeInvitaciones());
    if (!leida) return null;
    const filas = await this.dataSource.query(
      'SELECT id, organization_id, client_id, guest_name, guest_email FROM reservations WHERE id = ? LIMIT 1',
      [leida.reservationId],
    ) as Array<{ id: string; organization_id: string; client_id: string; guest_name: string | null; guest_email: string | null }>;
    const reserva = filas[0];
    if (!reserva || reserva.organization_id !== survey.organizationId) return null;
    if (survey.clientId && reserva.client_id !== survey.clientId) return null;
    return { reservationId: reserva.id, nombre: reserva.guest_name, correo: reserva.guest_email };
  }

  /**
   * Guarda la nota y dice qué ofrecer después.
   *
   * Si la misma invitación ya había dejado una nota —dos clics, o volver al enlace otro día—, se
   * actualiza esa respuesta en lugar de crear otra: una visita cuenta una vez en los resultados.
   */
  async iniciar(surveyId: string, rating: unknown, invitacion?: string, origen?: string): Promise<RespuestaIniciada> {
    const survey = await this.activa(surveyId);
    const pregunta = preguntaDeNota(survey.questions ?? []);
    if (!pregunta) throw new BadRequestException('Esta encuesta no empieza con una nota');
    if (!notaValida(rating)) throw new BadRequestException('La nota tiene que ser de 1 a 5 estrellas');

    const persona = await this.quienResponde(survey, invitacion);
    const token = randomBytes(24).toString('base64url');
    const tokenHash = hashDelToken(token);

    const respuesta = await this.dataSource.transaction(async (manager) => {
      const previa = persona
        ? await manager.findOne(SurveyResponse, { where: { surveyId: survey.id, reservationId: persona.reservationId } })
        : null;

      if (previa) {
        await manager.update(SurveyResponse, { id: previa.id }, {
          rating,
          answers: { ...(previa.answers ?? {}), [pregunta.id]: rating },
          editTokenHash: tokenHash,
        });
        return { ...previa, rating };
      }

      const nueva = await manager.save(manager.create(SurveyResponse, {
        organizationId: survey.organizationId,
        surveyId: survey.id,
        respondentId: persona
          ? `reserva:${persona.reservationId}`
          : `public:${(origen?.trim() || 'link').slice(0, 40)}:${randomUUID()}`.slice(0, 100),
        answers: { [pregunta.id]: rating },
        rating,
        reservationId: persona?.reservationId ?? null,
        respondentName: persona?.nombre ?? null,
        respondentEmail: persona?.correo ?? null,
        editTokenHash: tokenHash,
      }));
      await manager.increment(Survey, { id: survey.id }, 'responseCount', 1);
      return nueva;
    });

    return {
      responseId: respuesta.id,
      token,
      rating,
      siguiente: siguientePaso(rating, Number(survey.googleReview?.minRating)),
      reviewUrl: urlDeResena(String(survey.googleReview?.url || '')),
      nombre: persona?.nombre ? persona.nombre.trim().split(/\s+/)[0] : null,
    };
  }

  /**
   * Completa la respuesta: preguntas, mensaje al equipo, o sólo cerrarla.
   *
   * @param responder Si eligió contestar la encuesta. Sólo entonces se exigen las obligatorias.
   */
  async completar(
    surveyId: string,
    responseId: string,
    token: string,
    datos: { answers?: Record<string, string | number>; teamMessage?: string; responder?: boolean; terminar?: boolean },
  ): Promise<{ completed: boolean }> {
    const survey = await this.activa(surveyId);
    const respuesta = await this.responses
      .createQueryBuilder('r')
      .addSelect('r.editTokenHash')
      .where('r.id = :id AND r.surveyId = :surveyId', { id: responseId, surveyId: survey.id })
      .getOne();
    if (!respuesta) throw new NotFoundException('No encontramos esa respuesta');

    // El token prueba que quien completa es quien empezó. Sin él, cualquiera con el id de una
    // respuesta podría escribir en ella.
    const esperado = Buffer.from(respuesta.editTokenHash || '');
    const recibido = Buffer.from(hashDelToken(token || ''));
    if (!respuesta.editTokenHash || esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) {
      throw new ForbiddenException('No se puede modificar esta respuesta');
    }

    let respuestas: Record<string, string | number>;
    try {
      respuestas = unirRespuestas(survey.questions ?? [], respuesta.answers ?? {}, datos.answers);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Respuesta inválida');
    }

    if (datos.responder && datos.terminar) {
      const faltan = obligatoriasPendientes(survey.questions ?? [], respuestas);
      if (faltan.length > 0) throw new BadRequestException(`Faltan respuestas: ${faltan.join(', ')}`);
    }

    const mensaje = typeof datos.teamMessage === 'string' ? datos.teamMessage.trim().slice(0, LARGO_MAXIMO_MENSAJE) : undefined;
    const mensajeNuevo = Boolean(mensaje) && mensaje !== (respuesta.teamMessage ?? '').trim();

    await this.responses.update({ id: respuesta.id }, {
      answers: respuestas,
      ...(mensaje !== undefined ? { teamMessage: mensaje || null } : {}),
      ...(datos.terminar ? { completedAt: new Date() } : {}),
    });

    if (mensajeNuevo && mensaje) {
      // Fuera de la respuesta a quien escribió: un servidor de correo lento no puede dejarlo
      // esperando, y si el aviso falla el mensaje igual queda guardado en los resultados.
      void this.avisarAlEquipo(survey, { ...respuesta, teamMessage: mensaje }).catch((error) => {
        this.logger.warn(`No se pudo avisar al equipo del mensaje de la respuesta ${respuesta.id}: ${error instanceof Error ? error.message : error}`);
      });
    }

    return { completed: Boolean(datos.terminar) };
  }

  /**
   * Le hace llegar al local lo que la persona escribió.
   *
   * Sólo cuando la respuesta viene de una reserva se sabe qué local la atendió y a quién avisar.
   * Una encuesta abierta por QR no tiene a quién escribirle: el mensaje queda en los resultados.
   * La respuesta va dirigida a la persona, para que el local le conteste directo desde su correo.
   */
  private async avisarAlEquipo(survey: Survey, respuesta: SurveyResponse): Promise<void> {
    if (!respuesta.reservationId) return;
    const filas = await this.dataSource.query(
      `SELECT f.name, f.team_notifications, f.design_config
         FROM reservations r JOIN reservation_forms f ON f.id = r.form_id
        WHERE r.id = ? AND r.organization_id = ? LIMIT 1`,
      [respuesta.reservationId, survey.organizationId],
    ) as Array<{ name: string; team_notifications: unknown; design_config: unknown }>;
    const local = filas[0];
    if (!local) return;

    const parsear = (valor: unknown): unknown => {
      if (typeof valor !== 'string') return valor;
      try { return JSON.parse(valor); } catch { return undefined; }
    };
    const equipo = parsear(local.team_notifications);
    const diseno = parsear(local.design_config) as Record<string, unknown> | undefined;
    const destinatarios = new Set<string>(
      (Array.isArray(equipo) ? equipo : []).filter((correo): correo is string => typeof correo === 'string' && correo.includes('@')),
    );
    if (destinatarios.size === 0 && typeof diseno?.supportEmail === 'string' && diseno.supportEmail.includes('@')) {
      destinatarios.add(diseno.supportEmail);
    }
    if (destinatarios.size === 0) return;

    const quien = respuesta.respondentName?.trim() || 'Una persona que los visitó';
    const html = armazonDeCorreo(
      `${quien} les dejó un mensaje`,
      `Calificó su visita a ${local.name} con ${respuesta.rating ?? '—'} de 5 y quiso contarles esto antes de publicar nada:\n\n«${respuesta.teamMessage}»${respuesta.respondentEmail ? '\n\nPueden responderle directo a este correo.' : ''}`,
      undefined,
      undefined,
      [
        { etiqueta: 'Encuesta', valor: survey.title },
        { etiqueta: 'Nota', valor: `${respuesta.rating ?? '—'} de 5` },
        ...(respuesta.respondentEmail ? [{ etiqueta: 'Correo', valor: respuesta.respondentEmail }] : []),
      ],
    );
    for (const destino of destinatarios) {
      await this.correo.send(destino, `Mensaje de ${quien} sobre su visita`, html, respuesta.respondentEmail ? { replyTo: respuesta.respondentEmail } : undefined);
    }
  }
}
