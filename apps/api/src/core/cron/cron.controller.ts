import { Controller, Get, Post, Headers, ForbiddenException, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { Public } from '../auth/decorators/public.decorator';
import { MetaConversionOutboxService } from '../../modules/integrations/meta/meta-conversion-outbox.service';
import { GoogleConversionOutboxService } from '../../modules/integrations/google/google-conversion-outbox.service';
import { DetectStalePiecesJob } from '../jobs/cron/detect-stale-pieces.job';
import { LeadsParadosJob } from '../jobs/cron/leads-parados.job';
import { RecordatorioDeTareasJob } from '../jobs/cron/recordatorio-de-tareas.job';
import { ResumenDiarioJob } from '../jobs/cron/resumen-diario.job';
import { SaludoDeCumpleanosJob } from '../jobs/cron/saludo-de-cumpleanos.job';
import { RecordatorioDeReservasJob } from '../jobs/cron/recordatorio-de-reservas.job';
import { OperationalAlertsJob } from '../jobs/cron/operational-alerts.job';
import { CreateMonthlyCyclesJob } from '../jobs/cron/create-monthly-cycles.job';
import { CollectionEmailsJob } from '../jobs/cron/collection-emails.job';
import { PurgeExpiredLeadsJob } from '../jobs/cron/purge-expired-leads.job';
import { RecoverReservationIntegrationsJob } from '../jobs/cron/recover-reservation-integrations.job';
import { CloseXpPeriodsJob } from '../jobs/cron/close-xp-periods.job';

@Controller('cron')
@Public()
export class CronController {
  private readonly running = new Set<string>();

  constructor(
    private readonly capiOutbox: MetaConversionOutboxService,
    private readonly googleOutbox: GoogleConversionOutboxService,
    private readonly stale: DetectStalePiecesJob,
    private readonly leadsParados: LeadsParadosJob,
    private readonly recordatorios: RecordatorioDeTareasJob,
    private readonly resumen: ResumenDiarioJob,
    private readonly cumpleanos: SaludoDeCumpleanosJob,
    private readonly recordatorioReservas: RecordatorioDeReservasJob,
    private readonly operationalAlerts: OperationalAlertsJob,
    private readonly cycles: CreateMonthlyCyclesJob,
    private readonly collections: CollectionEmailsJob,
    private readonly purge: PurgeExpiredLeadsJob,
    private readonly reservationIntegrations: RecoverReservationIntegrationsJob,
    private readonly xp: CloseXpPeriodsJob,
  ) {}

  /**
   * Comprueba la clave que trae el disparador de tareas.
   *
   * Acepta **dos** claves: la vigente y la anterior, si está declarada. Con una sola, rotarla
   * obligaba a cambiarla en el servidor de tareas y en el `.env` a la vez, y entre un cambio y el
   * otro las tareas dejaban de correr: la cobranza no se manda, las conversiones no se entregan y
   * los leads vencidos no se purgan, sin que nada avise porque un cron que no corre no da error.
   *
   * Con dos, la rotación es en tres pasos y sin corte: se mueve la vigente a `CRON_SECRET_PREVIOUS`
   * y se pone la nueva en `CRON_SECRET`, se actualiza el disparador cuando se pueda, y se borra la
   * anterior. Dejarla puesta para siempre desharía el sentido de rotar, así que el último paso
   * hay que hacerlo.
   *
   * La comparación es en tiempo constante: una comparación normal filtra la clave carácter a
   * carácter, midiendo cuánto tarda en fallar.
   */
  private verifySecret(secret?: string): void {
    const vigente = process.env.CRON_SECRET;
    if (!vigente) throw new ForbiddenException('CRON_SECRET not configured');

    const anterior = process.env.CRON_SECRET_PREVIOUS;
    const candidatas = anterior ? [vigente, anterior] : [vigente];
    const recibida = Buffer.from(secret ?? '');

    const coincide = candidatas.some((clave) => {
      const esperada = Buffer.from(clave);
      return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
    });

    if (!coincide) throw new ForbiddenException('Invalid cron secret');
  }

  @Post('meta-capi')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processMetaCapiPost(@Headers('x-cron-secret') secret: string, @Body('limit') limit?: number) {
    this.verifySecret(secret);
    return this.runMetaCapi(limit);
  }

  @Get('meta-capi')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processMetaCapi(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runMetaCapi();
  }

  private async runMetaCapi(limit?: number) {
    const lockKey = 'meta-capi';
    if (this.running.has(lockKey)) return { ok: true, skipped: 'already_running' };
    this.running.add(lockKey);
    try {
      const result = await this.capiOutbox.processPending(limit ?? 50);
      return { ok: true, processed: result.processed, failed: result.failed, timestamp: new Date().toISOString() };
    } finally {
      this.running.delete(lockKey);
    }
  }

  @Get('meta-capi/diagnostics')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  async capiDiagnostics(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    const stats = await this.capiOutbox.stats();
    return { ok: true, ...stats, timestamp: new Date().toISOString() };
  }

  @Post('google-ads')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processGoogleAdsPost(@Headers('x-cron-secret') secret: string, @Body('limit') limit?: number) {
    this.verifySecret(secret);
    return this.runGoogleAds(limit);
  }

  @Get('google-ads')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processGoogleAds(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runGoogleAds();
  }

  private async runGoogleAds(limit?: number) {
    const lockKey = 'google-ads';
    if (this.running.has(lockKey)) return { ok: true, skipped: 'already_running' };
    this.running.add(lockKey);
    try {
      const result = await this.googleOutbox.processPending(limit ?? 50);
      return { ok: true, processed: result.processed, failed: result.failed, timestamp: new Date().toISOString() };
    } finally {
      this.running.delete(lockKey);
    }
  }

  @Get('google-ads/diagnostics')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  async googleAdsDiagnostics(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    const stats = await this.googleOutbox.stats();
    return { ok: true, ...stats, timestamp: new Date().toISOString() };
  }

  @Post('meta-capi/cleanup')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async cleanupOutbox(@Headers('x-cron-secret') secret: string, @Body('olderThanDays') olderThanDays?: number) {
    this.verifySecret(secret);
    const result = await this.capiOutbox.cleanup(olderThanDays ?? 7);
    return { ok: true, ...result, timestamp: new Date().toISOString() };
  }

  /**
   * Ejecuta un trabajo evitando que se solape consigo mismo.
   *
   * Lo que devuelva el trabajo se incluye en la respuesta, para que quien dispara el cron
   * pueda ver el resultado sin entrar a los registros.
   */
  private async runLocked(lockKey: string, task: () => Promise<void | Record<string, unknown>>) {
    if (this.running.has(lockKey)) return { ok: true, skipped: 'already_running' };
    this.running.add(lockKey);
    try {
      const result = await task();
      return { ok: true, ...(result ?? {}), timestamp: new Date().toISOString() };
    } finally {
      this.running.delete(lockKey);
    }
  }

  /*
   * Los dos verbos, igual que el resto.
   *
   * Los programadores de cron de cPanel solo saben hacer GET, y el POST es el correcto para algo
   * que escribe. Ofrecer ambos evita elegir entre lo correcto y lo que se puede configurar.
   */
  @Post('leads-parados')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async leadsParadosPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('leads-parados', () => this.leadsParados.handle());
  }

  @Get('leads-parados')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async leadsParadosGet(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('leads-parados', () => this.leadsParados.handle());
  }

  @Post('recordatorio-tareas')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async recordatorioTareasPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('recordatorio-tareas', () => this.recordatorios.handle());
  }

  @Get('recordatorio-tareas')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async recordatorioTareasGet(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('recordatorio-tareas', () => this.recordatorios.handle());
  }

  @Post('resumen-diario')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async resumenPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('resumen-diario', () => this.resumen.handle());
  }

  @Get('resumen-diario')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async resumenGet(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('resumen-diario', () => this.resumen.handle());
  }

  @Post('cumpleanos')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async cumpleanosPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('cumpleanos', () => this.cumpleanos.handle());
  }

  @Get('cumpleanos')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async cumpleanosGet(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('cumpleanos', () => this.cumpleanos.handle());
  }

  @Post('recordatorio-reservas')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async recordatorioReservasPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('recordatorio-reservas', () => this.recordatorioReservas.handle());
  }

  @Get('recordatorio-reservas')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async recordatorioReservasGet(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('recordatorio-reservas', () => this.recordatorioReservas.handle());
  }

  @Post('stale-pieces')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processStalePiecesPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('stale-pieces', () => this.stale.handle());
  }

  @Get('stale-pieces')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processStalePieces(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('stale-pieces', () => this.stale.handle());
  }

  @Post('operational-alerts')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processOperationalAlertsPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('operational-alerts', () => this.operationalAlerts.handle());
  }

  @Get('operational-alerts')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processOperationalAlerts(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('operational-alerts', () => this.operationalAlerts.handle());
  }

  @Post('monthly-cycles')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async processMonthlyCyclesPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('monthly-cycles', () => this.cycles.handle());
  }

  @Get('monthly-cycles')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async processMonthlyCycles(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('monthly-cycles', () => this.cycles.handle());
  }

  @Post('collection-emails')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async processCollectionEmailsPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('collection-emails', () => this.collections.handle());
  }

  @Get('collection-emails')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async processCollectionEmails(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('collection-emails', () => this.collections.handle());
  }

  @Post('data-retention')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async processDataRetentionPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('data-retention', () => this.purge.handle());
  }

  @Get('data-retention')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async processDataRetention(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('data-retention', () => this.purge.handle());
  }

  @Post('reservation-integrations')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async recoverReservationIntegrationsPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('reservation-integrations', () => this.reservationIntegrations.handle());
  }

  @Get('reservation-integrations')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async recoverReservationIntegrations(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('reservation-integrations', () => this.reservationIntegrations.handle());
  }

  @Post('xp-periods')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processXpPeriodsPost(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('xp-periods', () => this.xp.handle());
  }

  @Get('xp-periods')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async processXpPeriods(@Headers('x-cron-secret') secret: string) {
    this.verifySecret(secret);
    return this.runLocked('xp-periods', () => this.xp.handle());
  }
}
