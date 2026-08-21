import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ApprovalRequest } from '../../approvals/approval-request.entity';
import { OPEN_STATUSES, PendingKind } from '../../approvals/approval-request-status.enum';

/** Lo que la tarjeta de un lead necesita saber de sus tareas, sin abrir la ficha. */
export interface LeadTaskSummary {
  /** Tareas abiertas sobre ese lead. */
  openTasks: number;
  /** La que vence antes, o la más antigua si ninguna tiene fecha. */
  nextStep: { title: string; dueAt: Date | null; overdue: boolean } | null;
}

/**
 * Resume las tareas abiertas de varios leads de una vez.
 *
 * El tablero necesita, por tarjeta, cuántas quedan y cuál es la siguiente. Preguntarlo lead por
 * lead son cien consultas para dibujar una pantalla; acá es una sola, agrupada en memoria.
 *
 * Muestra el **próximo paso** y no la última nota: quien mira el tablero está decidiendo a quién
 * llamar ahora, y para eso lo que importa es lo que falta, no lo que ya se hizo.
 */
@Injectable()
export class LeadTaskSummaryService {
  constructor(
    @InjectRepository(ApprovalRequest) private readonly pendientes: Repository<ApprovalRequest>,
  ) {}

  /**
   * @param leadIds - Leads a resumir. Con la lista vacía no consulta nada.
   * @returns Un mapa de id de lead a su resumen. Los leads sin tareas no aparecen.
   */
  async porLead(organizationId: string, leadIds: string[]): Promise<Map<string, LeadTaskSummary>> {
    const resumen = new Map<string, LeadTaskSummary>();
    if (leadIds.length === 0) return resumen;

    const tareas = await this.pendientes.find({
      where: {
        organizationId,
        kind: PendingKind.TASK,
        entityType: 'lead',
        entityId: In(leadIds),
        status: In([...OPEN_STATUSES]),
      } as never,
      select: { id: true, entityId: true, title: true, dueAt: true, createdAt: true },
      order: { createdAt: 'ASC' },
    });

    const ahora = Date.now();
    for (const tarea of tareas) {
      const actual = resumen.get(tarea.entityId) ?? { openTasks: 0, nextStep: null };
      actual.openTasks += 1;
      /*
       * Gana la que vence antes. Una tarea sin fecha nunca desplaza a una que sí la tiene: quien
       * puso plazo está diciendo cuándo importa, y quien no lo puso dejó eso abierto.
       */
      const vence = tarea.dueAt ? new Date(tarea.dueAt).getTime() : null;
      const actualVence = actual.nextStep?.dueAt ? new Date(actual.nextStep.dueAt).getTime() : null;
      const mejor = actual.nextStep === null
        || (vence !== null && (actualVence === null || vence < actualVence));
      if (mejor) {
        actual.nextStep = {
          title: tarea.title,
          dueAt: tarea.dueAt ?? null,
          overdue: vence !== null && vence < ahora,
        };
      }
      resumen.set(tarea.entityId, actual);
    }

    return resumen;
  }
}
