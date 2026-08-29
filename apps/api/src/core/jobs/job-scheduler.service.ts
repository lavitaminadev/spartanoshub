import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { CloseXpPeriodsJob } from './cron/close-xp-periods.job';
import { CreateMonthlyCyclesJob } from './cron/create-monthly-cycles.job';
import { DetectStalePiecesJob } from './cron/detect-stale-pieces.job';
import { LeadsParadosJob } from './cron/leads-parados.job';
import { RecordatorioDeTareasJob } from './cron/recordatorio-de-tareas.job';
import { CollectionEmailsJob } from './cron/collection-emails.job';
import { PurgeExpiredLeadsJob } from './cron/purge-expired-leads.job';
import { MetaLeadRecoveryJob } from './cron/meta-lead-recovery.job';
import { MetaConversionOutboxService } from '../../modules/integrations/meta/meta-conversion-outbox.service';
import { GoogleConversionOutboxService } from '../../modules/integrations/google/google-conversion-outbox.service';
import { OperationalAlertsJob } from './cron/operational-alerts.job';
import { AutomationRunnerService } from '../../modules/automations/automation-runner.service';
import { AutomationScheduleJob } from '../../modules/automations/automation-schedule.job';
import { WebhookDeliveryService } from '../../modules/automations/webhook-delivery.service';

@Injectable()
export class JobSchedulerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(JobSchedulerService.name);
  private readonly timers: NodeJS.Timeout[] = [];
  private running = new Set<string>();

  constructor(
    private readonly xp: CloseXpPeriodsJob,
    private readonly cycles: CreateMonthlyCyclesJob,
    private readonly stale: DetectStalePiecesJob,
    private readonly leadsParados: LeadsParadosJob,
    private readonly recordatorios: RecordatorioDeTareasJob,
    private readonly collections: CollectionEmailsJob,
    private readonly purge: PurgeExpiredLeadsJob,
    private readonly metaRecovery: MetaLeadRecoveryJob,
    private readonly capiOutbox: MetaConversionOutboxService,
    private readonly googleOutbox: GoogleConversionOutboxService,
    private readonly operationalAlerts: OperationalAlertsJob,
    private readonly automations: AutomationRunnerService,
    private readonly automationSchedule: AutomationScheduleJob,
    private readonly webhooks: WebhookDeliveryService,
  ) {}

  onModuleInit(): void {
    if (process.env.ENABLE_INTERNAL_SCHEDULER !== 'true') {
      this.logger.log('Internal scheduler disabled; use hosting cron or set ENABLE_INTERNAL_SCHEDULER=true');
      return;
    }
    this.schedule('meta-lead-recovery', 15 * 60_000, () => this.metaRecovery.handle());
    /*
     * Lote de 100 cada dos minutos, y no 25 cada cinco.
     *
     * Lo que importa no es el promedio sino la ráfaga. Con el ritmo anterior salían 300 eventos
     * por hora: un lunes que concentre cuatrocientas reservas en dos horas tarda casi siete en
     * vaciar la cola, y Meta recibe conversiones con ese retraso. No se pierde nada —para eso
     * está la bandeja— pero una conversión que llega tarde vale menos para atribuir campañas que
     * siguen activas.
     *
     * Subirlo no arriesga duplicados: `claimBatch` reserva el lote con bloqueo, así que dos
     * pasadas que se solapen no toman los mismos eventos.
     */
    this.schedule('meta-capi-outbox', 2 * 60_000, () => this.capiOutbox.processPending(100));
    // Google va acá por la misma razón que Meta, y faltaba: tenía endpoint de cron externo pero
    // nadie lo vaciaba desde adentro. Una reserva encola su conversión de Google igual que la de
    // Meta, así que sin esto quedaban esperando indefinidamente mientras las de Meta salían, y
    // la diferencia solo se nota al comparar campañas semanas después.
    // Mismo ritmo que Meta: una reserva encola en las dos colas a la vez, así que dimensionarlas
    // distinto solo consigue que una vaya al día y la otra arrastre.
    this.schedule('google-ads-outbox', 2 * 60_000, () => this.googleOutbox.processPending(100));
    // Cada minuto: es la resolución de las esperas. Una automatización que dice "esperar dos
    // horas" no puede reanudarse con un margen mayor que el intervalo de este trabajo.
    this.schedule('automation-runs', 60_000, () => this.automations.processPending());
    this.schedule('automation-cleanup', 24 * 60 * 60_000, () => this.automations.cleanup());
    // Cada hora basta: los disparadores de tiempo se limitan a un aviso por registro y por día,
    // así que consultar más seguido no adelantaría nada y solo sumaría lecturas.
    this.schedule('automation-schedule', 60 * 60_000, () => this.automationSchedule.handle());
    this.schedule('automation-webhooks', 60_000, () => this.webhooks.processPending());
    this.schedule('automation-webhooks-cleanup', 24 * 60 * 60_000, () => this.webhooks.cleanup());
    this.schedule('stale-pieces', 60 * 60_000, () => this.stale.handle());
    // Cada seis horas: los plazos se miden en días, y revisarlo cada hora solo repetiría trabajo
    // para adelantar el aviso unos minutos sobre un umbral que se cruza una vez al día.
    this.schedule('leads-parados', 6 * 60 * 60_000, () => this.leadsParados.handle());
    // Cada media hora: el aviso de tres horas antes se pasaría de largo con una cadencia mayor,
    // y llegar tarde a un recordatorio es lo mismo que no mandarlo.
    this.schedule('recordatorio-tareas', 30 * 60_000, () => this.recordatorios.handle());
    this.schedule('operational-alerts', 60 * 60_000, () => this.operationalAlerts.handle(), true);
    this.schedule('monthly-cycles', 24 * 60 * 60_000, () => this.cycles.handle(), true);
    this.schedule('collection-emails', 24 * 60 * 60_000, () => this.collections.handle());
    this.schedule('data-retention', 24 * 60 * 60_000, () => this.purge.handle());
    this.schedule('xp-periods', 6 * 60 * 60_000, () => this.xp.handle());
  }

  onApplicationShutdown(): void { for (const timer of this.timers) clearInterval(timer); }

  private schedule(name: string, interval: number, task: () => Promise<unknown>, runAtStartup = false): void {
    const run = async () => {
      if (this.running.has(name)) return;
      this.running.add(name);
      try { await task(); } catch (error) { this.logger.error(`${name} failed`, error instanceof Error ? error.stack : undefined); }
      finally { this.running.delete(name); }
    };
    if (runAtStartup) void run();
    const timer = setInterval(() => void run(), interval); timer.unref(); this.timers.push(timer);
  }
}
