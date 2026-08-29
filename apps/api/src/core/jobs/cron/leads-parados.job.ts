import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Lead } from '../../../modules/crm/leads/lead.entity';
import {
  CLAVE_ABANDONO,
  CLAVE_ALERTA,
  CLAVE_AVISO,
  PLAZOS_POR_DEFECTO,
  type NivelDeInactividad,
  type PlazosDeInactividad,
  inactividadDe,
} from '../../../modules/crm/leads/inactividad-del-lead';
import { Notification } from '../../notifications/notification.entity';
import { ParameterResolver } from '../../parameters/parameter-resolver.service';

/** Gravedad creciente. Sirve para saber si un nivel es peor que el ya avisado. */
const ORDEN: Array<Exclude<NivelDeInactividad, null>> = ['notice', 'warning', 'critical'];

/** Qué dice cada aviso. Nombra el lead y la etapa: sin eso hay que abrirlo para saber si urge. */
const MENSAJE: Record<Exclude<NivelDeInactividad, null>, { titulo: string; verbo: string }> = {
  notice: { titulo: 'Lead sin mover', verbo: 'lleva' },
  warning: { titulo: 'Lead enfriándose', verbo: 'lleva ya' },
  critical: { titulo: 'Lead abandonado', verbo: 'lleva' },
};

/**
 * Avisa a quien lleva un lead cuando se le queda parado.
 *
 * Tres avisos y no uno, porque «tres días sin tocar» y «dos semanas abandonado» piden cosas
 * distintas: el primero es un recordatorio y el último es un negocio que se está perdiendo. Los
 * plazos son ajustes de la organización, no números fijos: en un ciclo de venta de dos semanas
 * tres días parado es alarmante, y en uno de seis meses no significa nada.
 *
 * **Cada nivel avisa una sola vez.** Sin eso, quien lleva el lead recibiría la misma notificación
 * en cada pasada hasta moverlo, y aprendería a ignorarlas todas —incluidas las que sí importan—.
 * Lo avisado se olvida al cambiar de etapa, así que un lead que avanza y se vuelve a parar
 * vuelve a avisar.
 *
 * Un lead sin responsable no genera notificación: no hay a quién mandársela. Queda marcado en el
 * tablero igualmente, que es donde se ve que nadie lo tomó.
 */
@Injectable()
export class LeadsParadosJob {
  private readonly logger = new Logger(LeadsParadosJob.name);

  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Notification) private readonly notificaciones: Repository<Notification>,
    private readonly parametros: ParameterResolver,
  ) {}

  async handle(): Promise<void> {
    /*
     * Solo los que están en curso y tienen dueño.
     *
     * Los cerrados llevan parados por definición, y avisar de ellos llenaría la campanita de
     * trabajo ya hecho. El filtro va en la consulta y no en el bucle para no traerse la tabla
     * entera en organizaciones con historial largo.
     */
    const candidatos = await this.leads.find({
      where: {
        status: Not(In(['won', 'lost', 'attended', 'no_show'])),
        assignedTo: Not(IsNull()),
      },
      select: {
        id: true, organizationId: true, name: true, status: true,
        assignedTo: true, stageChangedAt: true, createdAt: true, idleAlertedLevel: true,
      },
    });

    // Los plazos se resuelven una vez por organización: son los mismos para todos sus leads y
    // preguntarlos por lead sería una consulta por tarjeta.
    const plazosPorOrganizacion = new Map<string, PlazosDeInactividad>();
    let avisados = 0;

    for (const lead of candidatos) {
      // Un lead con datos raros no puede impedir avisar del resto en esta misma pasada.
      try {
        let plazos = plazosPorOrganizacion.get(lead.organizationId);
        if (!plazos) {
          plazos = await this.plazosDe(lead.organizationId);
          plazosPorOrganizacion.set(lead.organizationId, plazos);
        }

        const { idleDays, idleLevel } = inactividadDe(lead, plazos);
        if (!idleLevel) continue;

        /*
         * Solo se avisa al empeorar.
         *
         * Un lead que ya avisó como «enfriándose» no vuelve a avisar por seguir enfriándose; sí
         * lo hace cuando pasa a abandonado, que es información nueva.
         */
        const yaAvisado = ORDEN.indexOf(lead.idleAlertedLevel as Exclude<NivelDeInactividad, null>);
        if (yaAvisado >= ORDEN.indexOf(idleLevel)) continue;

        const { titulo, verbo } = MENSAJE[idleLevel];
        await this.notificaciones.save(this.notificaciones.create({
          userId: lead.assignedTo as string,
          organizationId: lead.organizationId,
          type: 'lead.idle',
          title: titulo,
          message: `«${lead.name}» ${verbo} ${idleDays} ${idleDays === 1 ? 'día' : 'días'} sin avanzar.`,
          data: { leadId: lead.id, status: lead.status, idleDays, idleLevel },
        }));

        // Después de notificar: si el guardado fallara, el aviso se repetiría en la siguiente
        // pasada, que es preferible a marcarlo como avisado sin haberlo mandado.
        await this.leads.update(lead.id, { idleAlertedLevel: idleLevel });
        avisados += 1;
      } catch (error) {
        this.logger.error(
          `No se pudo avisar del lead ${lead.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    this.logger.log(`Leads parados avisados: ${avisados} de ${candidatos.length} revisados`);
  }

  /** Los tres plazos de una organización, con los de fábrica para lo que no haya configurado. */
  private async plazosDe(organizationId: string): Promise<PlazosDeInactividad> {
    const ajustes = await this.parametros.getManyForOrganization(
      [CLAVE_AVISO, CLAVE_ALERTA, CLAVE_ABANDONO],
      organizationId,
    );
    return {
      notice: Number(ajustes.get(CLAVE_AVISO) ?? PLAZOS_POR_DEFECTO.notice),
      warning: Number(ajustes.get(CLAVE_ALERTA) ?? PLAZOS_POR_DEFECTO.warning),
      critical: Number(ajustes.get(CLAVE_ABANDONO) ?? PLAZOS_POR_DEFECTO.critical),
    };
  }
}
