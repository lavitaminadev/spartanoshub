import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../../../core/notifications/notification.service';
import { LeadStatus } from './lead-status.enum';
import type { Lead } from './lead.entity';

/**
 * Estados en los que un lead deja de esperar gestión.
 *
 * `no_show` cuenta como cierre: quien no llegó a su cita se retoma abriendo uno nuevo, no
 * dejando el anterior corriendo. Es el mismo criterio que usa el inicio para contar la carga.
 */
const CIERRES: Record<string, { titulo: string; bueno: boolean }> = {
  [LeadStatus.WON]: { titulo: 'Venta cerrada', bueno: true },
  [LeadStatus.ATTENDED]: { titulo: 'Asistió', bueno: true },
  [LeadStatus.LOST]: { titulo: 'Descartado', bueno: false },
  [LeadStatus.NO_SHOW]: { titulo: 'No asistió', bueno: false },
};

/**
 * Avisa cuando un lead llega al final de su recorrido.
 *
 * Hasta ahora un lead se cerraba en silencio. Quien lo trabajaba se enteraba al volver a mirar,
 * y quien lo había repartido no se enteraba nunca: para saber si algo se cerró había que abrir
 * el tablero y notar que una tarjeta ya no está donde estaba, que es una forma de no enterarse.
 *
 * Avisa a **quien lo tenía asignado**, no a todo el mundo. Un aviso que reciben quince personas
 * se aprende a ignorar en dos días, y entonces deja de servir también para las que sí lo
 * necesitaban. Si el cierre lo hizo la misma persona que lo llevaba, no se le avisa de lo que
 * acaba de hacer.
 */
@Injectable()
export class LeadCierreService {
  private readonly logger = new Logger(LeadCierreService.name);

  constructor(private readonly notificaciones: NotificationService) {}

  /**
   * @param anterior - Estado del que viene. Sin él no se puede distinguir un cierre de una
   *   edición cualquiera sobre un lead ya cerrado, y se avisaría en cada guardado.
   * @param actorId - Quien hizo el cambio, para no avisarle de su propia acción.
   */
  async avisar(lead: Lead, anterior: string, actorId?: string): Promise<void> {
    const cierre = CIERRES[lead.status];
    if (!cierre || anterior === lead.status) return;
    if (!lead.assignedTo || lead.assignedTo === actorId) return;

    const detalle = cierre.bueno
      ? `${lead.name} llegó al final del embudo.`
      : `${lead.name} salió del embudo${lead.discardReason ? `: ${lead.discardReason}` : '.'}`;

    try {
      await this.notificaciones.notifyUser(
        lead.organizationId,
        lead.assignedTo,
        'crm.lead.cerrado',
        `${cierre.titulo} · ${lead.name}`,
        detalle,
        { leadId: lead.id, status: lead.status, clientId: lead.clientId ?? null },
      );
    } catch (error) {
      /*
       * Un aviso que no sale no puede tumbar el guardado.
       *
       * El cambio de etapa ya está escrito cuando esto corre: si el aviso falla y se propaga el
       * error, quien movió la tarjeta ve un fallo sobre algo que sí se guardó, y vuelve a
       * intentarlo. Se registra para poder mirarlo, y el trabajo sigue.
       */
      this.logger.warn(`No se pudo avisar del cierre del lead ${lead.id}: ${(error as Error).message}`);
    }
  }
}
