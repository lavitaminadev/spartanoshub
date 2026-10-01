import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Not, Repository } from 'typeorm';
import { PLAZOS_DE_CONSERVACION } from '@espartanos/shared';
import { Lead } from '../../../modules/crm/leads/lead.entity';
import { DataProtectionService } from '../../data-protection/data-protection.service';
import { ProcessCommentsService } from '../../../modules/collaboration/process-comments.service';
import { ParameterResolver } from '../../parameters/parameter-resolver.service';

/**
 * Dias que se conservan los datos personales de una reserva despues de ocurrida.
 *
 * Sale de `PLAZOS_DE_CONSERVACION`, el mismo valor que publican las politicas de privacidad.
 */
const RESERVATION_RETENTION_DAYS = Math.round(PLAZOS_DE_CONSERVACION.reservasMeses * 30.44);

/**
 * Etapas en las que un lead ya no espera nada de nadie.
 *
 * El plazo se cuenta sobre la etapa y no sobre la calidad: antes se miraba
 * , de modo que un descartado que habia llegado a calificarse no se
 * anonimizaba nunca —y es justo el que mas datos personales acumulo—. La calidad dice si valia
 * la pena; la etapa dice si el trato termino, que es lo que la retencion mide.
 *
 * Las ventas quedan fuera: la relacion comercial es el fundamento que permite conservarlas, y su
 * respaldo tiene plazos propios mas largos.
 */
/**
 * Etapas cuyo dato personal conserva un fundamento para seguir guardado.
 *
 * Solo la venta: la relacion comercial es lo que permite conservar los datos de un cliente, y su
 * respaldo tiene plazos propios mas largos que los de un prospecto.
 *
 * La regla era la contraria —se anonimizaba solo lo cerrado como perdido o no asistido— y dejaba
 * fuera el caso mas comun: el lead que nadie movio nunca. Un prospecto que lleva dos anos en
 * «Nuevo» no esta en curso, esta olvidado, y sus datos ya no sirven al fin para el que se
 * recogieron. Conservarlos por no haberlos cerrado es guardarlos por descuido.
 */
const ETAPAS_CON_FUNDAMENTO = ['won'];

@Injectable()
export class PurgeExpiredLeadsJob {
  private readonly logger = new Logger(PurgeExpiredLeadsJob.name);

  constructor(
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    private readonly dataProtection: DataProtectionService,
    private readonly comentarios: ProcessCommentsService,
    private readonly parametros: ParameterResolver,
  ) {}

  async handle(): Promise<void> {
    const now = new Date();
    this.logger.log('Reviewing expired CRM leads for anonymization...');

    const expiredLeads = await this.leadRepo.find({
      where: {
        retentionReviewAt: LessThan(now),
        status: Not(In(ETAPAS_CON_FUNDAMENTO)),
      },
      order: { retentionReviewAt: 'ASC' },
      take: 200,
    });

    let anonymized = 0;

    // try/catch per lead: this job processes up to 200 leads per run — one failure
    // (e.g. a constraint violation) must not stop the anonymization of the rest.
    for (const lead of expiredLeads) {
      if (lead.metadata?.retentionAnonymizedAt) continue;
      try {
        await this.dataProtection.anonymizeLead(lead.id, lead.organizationId, 'Retención expirada');
        anonymized += 1;
      } catch (error) {
        this.logger.error(`Failed to anonymize lead ${lead.id}: ${error instanceof Error ? error.message : error}`);
      }
    }

    this.logger.log(`Expired leads reviewed: ${expiredLeads.length}, anonymized: ${anonymized}`);

    // Los datos del comensal (nombre, telefono, correo y los identificadores de match de
    // Meta) viven en las reservas, no en los leads, y hasta ahora ningun trabajo los
    // revisaba. Se conservan mientras la ventana de conversion sigue viva y se anonimizan
    // despues, sin tocar fecha ni estado para no alterar la analitica de asistencia.
    const reservations = await this.dataProtection.anonymizeExpiredReservations(RESERVATION_RETENTION_DAYS, 'Retención expirada', PLAZOS_DE_CONSERVACION.clientesConBeneficiosMeses);
    this.logger.log(`Expired reservations reviewed: ${reservations.reviewed}, anonymized: ${reservations.anonymized}`);

    // El resto de los plazos publicados; cada paso es independiente para que un fallo no frene a los demas.
    const pasos: Array<[string, () => Promise<number>]> = [
      ['measurement identifiers cleared', () => this.dataProtection.borrarIdentificadoresDeMedicionVencidos(PLAZOS_DE_CONSERVACION.medicionMeses)],
      ['group requests anonymized', () => this.dataProtection.anonimizarSolicitudesDeGrupoVencidas(PLAZOS_DE_CONSERVACION.solicitudesDeGrupoMeses)],
      ['survey responses anonymized', () => this.dataProtection.anonimizarRespuestasDeEncuestaVencidas(PLAZOS_DE_CONSERVACION.encuestasMeses)],
      /*
       * Los comentarios de los trabajos ya cerrados.
       *
       * El ajuste `compliance.work_comment_retention_days` existía, se podía cambiar en pantalla
       * y no lo leía nadie: la función que despersonaliza estaba escrita desde hacía meses y
       * ningún trabajo la llamaba. Un ajuste que no hace nada es peor que uno que falta, porque
       * quien lo configura cree que quedó cubierto.
       *
       * El plazo sale de la organización y no de `PLAZOS_DE_CONSERVACION` como los de arriba:
       * éste no se publica en la política de privacidad del comensal —son conversaciones del
       * equipo sobre su trabajo— y lo fija cada organización. Sin valor no se hace nada, que es
       * lo correcto: «sin plazo fijado» no significa «bórralo ya».
       */
      ['work comments anonymized', async () => {
        const dias = Number(await this.parametros.get('compliance.work_comment_retention_days') ?? 0);
        return this.comentarios.anonimizarComentariosDeTrabajosCerrados(dias);
      }],
    ];
    for (const [nombre, paso] of pasos) {
      try {
        this.logger.log(`Retention: ${await paso()} ${nombre}`);
      } catch (error) {
        this.logger.error(`Retention step failed (${nombre}): ${error instanceof Error ? error.message : error}`);
      }
    }
  }
}
