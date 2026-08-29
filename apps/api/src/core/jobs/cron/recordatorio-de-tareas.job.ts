import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import { ApprovalRequest } from '../../../modules/approvals/approval-request.entity';
import { ApprovalRequestStatus, PendingKind } from '../../../modules/approvals/approval-request-status.enum';
import { User } from '../../../modules/users/user.entity';
import { Lead } from '../../../modules/crm/leads/lead.entity';
import { EmailService } from '../../notifications/email.service';
import { componerCorreo } from '../../notifications/plantilla-de-correo';
import { ParameterResolver } from '../../parameters/parameter-resolver.service';

const UNA_HORA = 3_600_000;

/**
 * Los dos avisos previos, del más lejano al más cercano.
 *
 * Se recorren en ese orden para que una tarea que se creó tarde reciba directamente el de tres
 * horas sin pasar por el de doce, que ya no tendría sentido mandar.
 */
const AVISOS = [
  { clave: '12h', horas: 12 },
  { clave: '3h', horas: 3 },
] as const;

/**
 * Avisa por correo antes de que venza una tarea agendada.
 *
 * Dos recordatorios: doce horas antes para poder reorganizar el día, y tres horas antes para no
 * olvidarla. El primero **solo se manda si la tarea se creó con más de doce horas de margen**:
 * avisar «tienes esto en doce horas» de algo que se agendó hace veinte minutos no informa de
 * nada, y ese ruido es lo que hace que se dejen de leer los que sí importan.
 *
 * Cada aviso se manda una sola vez. El trabajo corre cada media hora, así que sin esa constancia
 * el recordatorio de las doce horas llegaría veinticuatro veces antes que el de las tres.
 *
 * El texto sale de las plantillas editables de la organización, no del código: quien responde por
 * lo que reciben las personas tiene que poder corregirlo sin esperar un despliegue.
 */
@Injectable()
export class RecordatorioDeTareasJob {
  private readonly logger = new Logger(RecordatorioDeTareasJob.name);

  constructor(
    @InjectRepository(ApprovalRequest) private readonly tareas: Repository<ApprovalRequest>,
    @InjectRepository(User) private readonly usuarios: Repository<User>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    private readonly correo: EmailService,
    private readonly parametros: ParameterResolver,
  ) {}

  async handle(): Promise<void> {
    const ahora = new Date();

    /*
     * Solo lo que vence dentro de las próximas doce horas y sigue abierto.
     *
     * El límite inferior es `ahora`: una tarea ya vencida no necesita que le recuerden que iba a
     * vencer. De eso avisa el aviso de vencidas, que es otra cosa.
     */
    const candidatas = await this.tareas.find({
      where: {
        kind: PendingKind.TASK,
        status: Not(In([ApprovalRequestStatus.APPROVED, ApprovalRequestStatus.REJECTED])),
        dueAt: Between(ahora, new Date(ahora.getTime() + 12 * UNA_HORA)),
      },
      take: 500,
    });

    const encendidoPorOrganizacion = new Map<string, boolean>();
    let enviados = 0;

    for (const tarea of candidatas) {
      // Una tarea con datos raros no puede impedir avisar del resto en esta misma pasada.
      try {
        if (!tarea.assignedTo || !tarea.dueAt) continue;

        let encendido = encendidoPorOrganizacion.get(tarea.organizationId);
        if (encendido === undefined) {
          encendido = Boolean(await this.parametros.get(
            'email.task_reminder_enabled', null, null, tarea.organizationId,
          ));
          encendidoPorOrganizacion.set(tarea.organizationId, encendido);
        }
        if (!encendido) continue;

        const aviso = this.avisoQueToca(tarea, ahora);
        if (!aviso) continue;

        const responsable = await this.usuarios.findOne({
          where: { id: tarea.assignedTo },
          select: { id: true, name: true, email: true },
        });
        if (!responsable?.email) {
          this.logger.warn(`Tarea ${tarea.id}: su responsable no tiene correo`);
          continue;
        }

        await this.enviar(tarea, aviso.horas, responsable.name, responsable.email);

        // Después de enviar: si el guardado fallara, el recordatorio se repetiría en la siguiente
        // pasada, que es preferible a marcarlo como enviado sin haberlo mandado.
        await this.tareas.update(tarea.id, { reminderSent: aviso.clave });
        enviados += 1;
      } catch (error) {
        this.logger.error(
          `No se pudo recordar la tarea ${tarea.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    this.logger.log(`Recordatorios de tarea enviados: ${enviados} de ${candidatas.length} revisadas`);
  }

  /**
   * Qué aviso corresponde ahora, si es que corresponde alguno.
   *
   * @returns El más cercano que ya venció y todavía no se mandó, o `null`.
   */
  private avisoQueToca(
    tarea: ApprovalRequest,
    ahora: Date,
  ): { clave: string; horas: number } | null {
    const faltan = ((tarea.dueAt as Date).getTime() - ahora.getTime()) / UNA_HORA;

    /*
     * Cuánto margen hubo entre agendar y vencer.
     *
     * Es lo que decide si el aviso de doce horas tiene sentido: una tarea creada con dos horas de
     * margen no puede recibir un «te queda medio día», porque nunca le quedó medio día.
     */
    const margen = ((tarea.dueAt as Date).getTime() - tarea.createdAt.getTime()) / UNA_HORA;

    /*
     * Gana el umbral más cercano de los que ya se cruzaron.
     *
     * Se recorre del más próximo al más lejano y no al revés: a dos horas del vencimiento se han
     * cruzado los dos umbrales, y mandar «te quedan doce horas» sería mentir. Antes salía ese, y
     * el único caso en que se veía bien era cuando el de doce ya se había mandado.
     */
    for (const { clave, horas } of [...AVISOS].reverse()) {
      if (faltan > horas) continue;
      // El de doce horas se salta cuando la tarea nació con menos margen que eso: nunca le
      // quedó medio día, así que anunciarlo no informa de nada.
      if (horas === 12 && margen <= 12) continue;
      // Lo ya mandado no se repite, y no se retrocede a uno más lejano.
      if (tarea.reminderSent === clave || tarea.reminderSent === '3h') continue;
      return { clave, horas };
    }
    return null;
  }

  /** Arma el correo con la plantilla de la organización y lo manda. */
  private async enviar(
    tarea: ApprovalRequest,
    horas: number,
    nombre: string,
    destino: string,
  ): Promise<void> {
    const [asunto, cuerpo] = await Promise.all([
      this.parametros.get('email.task_reminder_subject', null, null, tarea.organizationId),
      this.parametros.get('email.task_reminder_body', null, null, tarea.organizationId),
    ]);

    /*
     * De qué prospecto es la tarea.
     *
     * Sin el nombre, «Llamar» a las nueve de la mañana no dice a quién. Si el lead ya no existe
     * —lo anonimizaron, lo borraron— el correo sale igual sin ese dato: perder el recordatorio
     * entero por un campo ausente es peor que un renglón vacío.
     */
    const lead = tarea.entityType === 'lead' && tarea.entityId
      ? await this.leads.findOne({ where: { id: tarea.entityId }, select: { id: true, name: true } })
      : null;

    const cuando = (tarea.dueAt as Date).toLocaleString('es-CL', {
      dateStyle: 'short', timeStyle: 'short',
    });

    const { subject, html } = componerCorreo(
      String(asunto ?? '{{tarea}} en {{horas}} horas'),
      String(cuerpo ?? 'Tienes «{{tarea}}» el {{cuando}}.'),
      { responsable: nombre, tarea: tarea.title, cuando, horas, lead: lead?.name ?? '' },
    );

    await this.correo.send(destino, subject, html);
  }
}
