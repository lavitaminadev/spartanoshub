import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { User } from '../../../modules/users/user.entity';
import { UserRole } from '../../../modules/organizations/user-role.enum';
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
 * **El lead sin responsable también avisa**, y a quien dirige el CRM. Antes se saltaba porque no
 * había a quién mandárselo, y eso funcionaba mientras todo lead nacía asignado. Desde que entran
 * sin dueño, saltárselos dejaría sin vigilancia justo lo que nadie ha tomado —que es lo que más
 * necesita que alguien lo mire—.
 */
@Injectable()
export class LeadsParadosJob {
  private readonly logger = new Logger(LeadsParadosJob.name);

  /** Quién recibe los huérfanos de cada organización. Se llena durante la pasada. */
  private readonly responsablePorOrganizacion = new Map<string, string | null>();

  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Notification) private readonly notificaciones: Repository<Notification>,
    @InjectRepository(User) private readonly usuarios: Repository<User>,
    private readonly parametros: ParameterResolver,
  ) {}

  async handle(): Promise<void> {
    /*
     * Todos los que están en curso, tengan dueño o no.
     *
     * Los cerrados llevan parados por definición, y avisar de ellos llenaría la campanita de
     * trabajo ya hecho. El filtro va en la consulta y no en el bucle para no traerse la tabla
     * entera en organizaciones con historial largo.
     */
    const candidatos = await this.leads.find({
      where: {
        status: Not(In(['won', 'lost', 'attended', 'no_show'])),
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
    // El cargo puede cambiar entre pasadas; lo recordado vale solo para esta.
    this.responsablePorOrganizacion.clear();

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

        /*
         * Sin responsable, el aviso sube a quien dirige el CRM.
         *
         * Un lead que nadie tomó y ya lleva días parado es un problema de reparto, no de
         * seguimiento: no hay ejecutivo al que recordarle nada, hay una cola de entrada que
         * nadie está mirando. Por eso el mensaje también es otro.
         */
        const destinatario = lead.assignedTo ?? await this.quienDirigeElCrm(lead.organizationId);
        // Sin nadie a quien avisar no se marca como avisado: cuando exista un cargo que reciba
        // el aviso, el lead sigue esperándolo.
        if (!destinatario) continue;

        const { titulo, verbo } = MENSAJE[idleLevel];
        const sinDuenio = !lead.assignedTo;
        await this.notificaciones.save(this.notificaciones.create({
          userId: destinatario,
          organizationId: lead.organizationId,
          type: 'lead.idle',
          title: sinDuenio ? 'Prospecto sin responsable' : titulo,
          message: sinDuenio
            ? `«${lead.name}» lleva ${idleDays} ${idleDays === 1 ? 'día' : 'días'} sin que nadie lo tome.`
            : `«${lead.name}» ${verbo} ${idleDays} ${idleDays === 1 ? 'día' : 'días'} sin avanzar.`,
          data: { leadId: lead.id, status: lead.status, idleDays, idleLevel, sinResponsable: sinDuenio },
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
  /**
   * A quién le llega lo que nadie tomó.
   *
   * La dirección comercial, y si no la hay, administración. Se resuelve una vez por
   * organización: es la misma respuesta para todos sus leads huérfanos.
   */
  private async quienDirigeElCrm(organizationId: string): Promise<string | undefined> {
    const recordado = this.responsablePorOrganizacion.get(organizationId);
    if (recordado !== undefined) return recordado ?? undefined;

    for (const role of [UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN]) {
      const persona = await this.usuarios.findOne({
        where: { organizationId, role, isActive: true },
        order: { createdAt: 'ASC' },
        select: { id: true },
      });
      if (persona) {
        this.responsablePorOrganizacion.set(organizationId, persona.id);
        return persona.id;
      }
    }

    this.responsablePorOrganizacion.set(organizationId, null);
    return undefined;
  }

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
