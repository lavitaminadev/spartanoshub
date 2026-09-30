import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CronRun } from '../cron/cron-run.entity';
import { CloseXpPeriodsJob } from './cron/close-xp-periods.job';
import { CreateMonthlyCyclesJob } from './cron/create-monthly-cycles.job';
import { DetectStalePiecesJob } from './cron/detect-stale-pieces.job';
import { LeadsParadosJob } from './cron/leads-parados.job';
import { RecordatorioDeTareasJob } from './cron/recordatorio-de-tareas.job';
import { ResumenDiarioJob } from './cron/resumen-diario.job';
import { SaludoDeCumpleanosJob } from './cron/saludo-de-cumpleanos.job';
import { RecordatorioDeReservasJob } from './cron/recordatorio-de-reservas.job';
import { EncuestaPostVisitaJob } from './cron/encuesta-post-visita.job';
import { CuponPostVisitaJob } from './cron/cupon-post-visita.job';
import { CollectionEmailsJob } from './cron/collection-emails.job';
import { PurgeExpiredLeadsJob } from './cron/purge-expired-leads.job';
import { MetaLeadRecoveryJob } from './cron/meta-lead-recovery.job';
import { MetaConversionOutboxService } from '../../modules/integrations/meta/meta-conversion-outbox.service';
import { GoogleConversionOutboxService } from '../../modules/integrations/google/google-conversion-outbox.service';
import { OperationalAlertsJob } from './cron/operational-alerts.job';
import { AutomationRunnerService } from '../../modules/automations/automation-runner.service';
import { AutomationScheduleJob } from '../../modules/automations/automation-schedule.job';
import { WebhookDeliveryService } from '../../modules/automations/webhook-delivery.service';
import { EnviosDeCampanaService } from '../../modules/marketing/envios-de-campana.service';
import { AutoCloseReservationsJob } from './cron/auto-close-reservations.job';

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
    private readonly resumen: ResumenDiarioJob,
    private readonly cumpleanos: SaludoDeCumpleanosJob,
    private readonly recordatorioReservas: RecordatorioDeReservasJob,
    private readonly encuestaPostVisita: EncuestaPostVisitaJob,
    private readonly cuponPostVisita: CuponPostVisitaJob,
    private readonly autoCloseReservations: AutoCloseReservationsJob,
    private readonly collections: CollectionEmailsJob,
    private readonly purge: PurgeExpiredLeadsJob,
    private readonly metaRecovery: MetaLeadRecoveryJob,
    private readonly capiOutbox: MetaConversionOutboxService,
    private readonly googleOutbox: GoogleConversionOutboxService,
    private readonly operationalAlerts: OperationalAlertsJob,
    private readonly automations: AutomationRunnerService,
    private readonly automationSchedule: AutomationScheduleJob,
    private readonly webhooks: WebhookDeliveryService,
    private readonly campanas: EnviosDeCampanaService,
    @InjectRepository(CronRun) private readonly corridas: Repository<CronRun>,
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
    /*
     * Las campañas encoladas, como red de seguridad.
     *
     * El cron del hosting es el mecanismo principal —corre cada cinco minutos y no depende de que
     * el proceso esté despierto— pero una cola sin quien la vacíe desde dentro se queda callada el
     * día que esa línea del crontab se pierda al migrar de servidor. Se cierran las terminadas en
     * la misma pasada, que es donde se sabe que ya no queda nada pendiente.
     */
    // En una línea a propósito: el contrato `outbox-drained` comprueba que la cola se vacíe de
    // verdad buscando `processPending` dentro de la llamada a `schedule`, y partirla lo burlaría.
    this.schedule('campanas-outbox', 2 * 60_000, async () => { await this.campanas.processPending(100); await this.campanas.cerrarTerminadas(); });

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
    /*
     * Los dos diarios se planifican cada 24 h y no a una hora concreta: el planificador
     * interno mide intervalos desde que arrancó el servidor, no relojes de pared. Para que
     * salgan a primera hora hay que dispararlos desde el cron de cPanel, que sí sabe de horas;
     * esto es la red de seguridad para que igualmente salgan una vez al día.
     */
    this.schedule('resumen-diario', 24 * 60 * 60_000, () => this.resumen.handle());
    this.schedule('cumpleanos', 24 * 60 * 60_000, () => this.cumpleanos.handle());
    // Cada media hora: la anticipación se configura en horas, y con una cadencia mayor el
    // recordatorio saldría con menos margen del que la empresa eligió.
    this.schedule('recordatorio-reservas', 30 * 60_000, () => this.recordatorioReservas.handle());
    this.schedule('encuesta-post-visita', 30 * 60_000, () => this.encuestaPostVisita.handle());
    // Cada hora basta: el cupón sale un día después de la visita, no hay prisa por minutos.
    this.schedule('cupon-post-visita', 60 * 60_000, () => this.cuponPostVisita.handle());
    this.schedule('auto-close-reservations', 15 * 60_000, () => this.autoCloseReservations.handle());
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
      try {
        await task();
        await this.anotar(name, true, null);
      } catch (error) {
        this.logger.error(`${name} failed`, error instanceof Error ? error.stack : undefined);
        await this.anotar(name, false, error instanceof Error ? error.message.slice(0, 500) : 'falló');
      } finally { this.running.delete(name); }
    };
    if (runAtStartup) void run();
    const timer = setInterval(() => void run(), interval); timer.unref(); this.timers.push(timer);
  }

  /**
   * Deja constancia de la corrida, igual que cuando la dispara el cron de cPanel.
   *
   * La pantalla de Correos decide si un aviso «sale» mirando cuándo corrió su tarea por última
   * vez, y sólo el cron de cPanel lo anotaba. Con el planificador interno haciendo el trabajo, los
   * avisos se enviaban y la pantalla igual los marcaba como «encendidos que no salen».
   *
   * Nunca hace fallar la tarea: el trabajo ya se hizo, y perderlo por no poder anotarlo sería peor.
   */
  private async anotar(task: string, ok: boolean, detail: string | null): Promise<void> {
    try {
      await this.corridas.save({ task, lastRunAt: new Date(), ok, detail });
    } catch (error) {
      this.logger.warn(`No se pudo anotar la corrida de ${task}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
