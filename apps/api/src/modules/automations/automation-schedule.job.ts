import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Not, Repository } from 'typeorm';
import { Opportunity } from '../crm/opportunities/opportunity.entity';
import { ApprovalRequest } from '../approvals/approval-request.entity';
import { ApprovalRequestStatus } from '../approvals/approval-request-status.enum';

/**
 * Cuántos registros se anuncian por pasada.
 *
 * El tope existe para que una acumulación histórica —cien tratos vencidos que nadie tocó en
 * meses— no genere cien ejecuciones de golpe en el primer arranque. Lo que quede se atiende en
 * la pasada siguiente.
 */
const BATCH_LIMIT = 50;

/**
 * Disparadores que no nacen de una acción sino del paso del tiempo.
 *
 * «Tarea vencida» y «trato sin seguimiento» no son eventos que alguien provoque: nadie hace
 * clic en «vencer». Son una condición que se cumple sola y que hay que ir a buscar, así que se
 * resuelven consultando cada cierto rato en vez de escuchando el bus.
 *
 * El trabajo solo **anuncia**. Quién reacciona y qué hace lo decide cada automatización, igual
 * que con los eventos de dominio. Si no hay ninguna escuchando, no ocurre nada.
 *
 * La guardia contra repeticiones vive en `AutomationRun`: su clave incluye la fecha, así que un
 * mismo trato vencido se anuncia una vez por día aunque el trabajo corra cada hora. Sin eso,
 * un trato olvidado generaría un aviso cada vez y el equipo dejaría de mirarlos.
 */
@Injectable()
export class AutomationScheduleJob {
  private readonly logger = new Logger(AutomationScheduleJob.name);

  constructor(
    @InjectRepository(Opportunity) private readonly opportunities: Repository<Opportunity>,
    @InjectRepository(ApprovalRequest) private readonly approvals: Repository<ApprovalRequest>,
    private readonly events: EventEmitter2,
  ) {}

  async handle(): Promise<{ overdueTasks: number; staleDeals: number }> {
    const [overdueTasks, staleDeals] = await Promise.all([
      this.announceOverdueTasks(),
      this.announceStaleDeals(),
    ]);
    if (overdueTasks || staleDeals) {
      this.logger.log(`Disparadores de tiempo: ${overdueTasks} tareas vencidas, ${staleDeals} tratos sin seguimiento`);
    }
    return { overdueTasks, staleDeals };
  }

  /** Aprobaciones cuya fecha de vencimiento pasó y siguen sin decidirse. */
  private async announceOverdueTasks(): Promise<number> {
    const pendientes = await this.approvals.find({
      where: {
        status: ApprovalRequestStatus.PENDING,
        dueAt: LessThan(new Date()),
      },
      order: { dueAt: 'ASC' },
      take: BATCH_LIMIT,
    });

    for (const approval of pendientes) {
      this.events.emit('task.overdue', {
        organizationId: approval.organizationId,
        approvalId: approval.id,
        entityType: approval.entityType,
        entityId: approval.entityId,
        title: approval.title,
        assignedTo: approval.assignedTo,
        clientId: approval.clientId,
        dueAt: approval.dueAt?.toISOString(),
        // Parte de la clave de unicidad de la ejecución: acota el aviso a uno por día.
        occurredOn: this.today(),
      });
    }
    return pendientes.length;
  }

  /**
   * Tratos abiertos cuya próxima acción quedó atrás.
   *
   * Se mira `nextActionAt` y no la fecha del último cambio: un trato puede llevar semanas
   * quieto porque así se acordó, y eso no es un descuido. Lo que sí lo es: haberse comprometido
   * a hacer algo en una fecha y que esa fecha haya pasado.
   */
  private async announceStaleDeals(): Promise<number> {
    const atrasados = await this.opportunities.find({
      where: {
        nextActionAt: LessThan(new Date()),
        stage: Not(IsNull()),
      },
      order: { nextActionAt: 'ASC' },
      take: BATCH_LIMIT * 2,
    });

    // Los cerrados se descartan acá y no en la consulta porque `stage` es texto libre y filtrar
    // por «no está en esta lista» en SQL rendiría peor que traer un lote y recortarlo.
    const abiertos = atrasados
      .filter((deal) => deal.stage !== 'won' && deal.stage !== 'lost')
      .slice(0, BATCH_LIMIT);

    for (const deal of abiertos) {
      this.events.emit('deal.stale', {
        organizationId: deal.organizationId,
        opportunityId: deal.id,
        leadId: deal.leadId,
        clientId: deal.clientId,
        stage: deal.stage,
        amount: deal.amount,
        assignedTo: deal.assignedTo,
        nextAction: deal.nextAction,
        nextActionAt: deal.nextActionAt?.toISOString(),
        occurredOn: this.today(),
      });
    }
    return abiertos.length;
  }

  /** Fecha en formato `AAAA-MM-DD`, para acotar el aviso a uno por día. */
  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
