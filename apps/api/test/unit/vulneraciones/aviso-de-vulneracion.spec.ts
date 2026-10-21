import { describe, expect, it, vi } from 'vitest';
import { OperationalAlertsJob } from '../../../src/core/jobs/cron/operational-alerts.job';
import { plazoDeAviso } from '../../../src/modules/vulneraciones/plazo-de-aviso';

const HORA = 3_600_000;
const hace = (horas: number) => new Date(Date.now() - horas * HORA);

function trabajo(incidentes: unknown[]) {
  const dataSource = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('FROM security_incidents')) return incidentes;
      if (sql.includes('role IN')) return [{ id: 'dir-1' }];
      return [];
    }),
  };
  const notificaciones = { create: vi.fn((v: unknown) => v), save: vi.fn(async (v: unknown) => v) };
  const job = new OperationalAlertsJob(dataSource as never, notificaciones as never, { get: vi.fn() } as never);
  return { job: job as unknown as { vulneracionAlerts(org: string): Promise<number> }, notificaciones };
}

describe('plazo de aviso de una vulneración', () => {
  it('corre 48 horas desde la detección', () => {
    expect(plazoDeAviso(hace(10), null).estado).toBe('a tiempo');
    expect(plazoDeAviso(hace(30), null).estado).toBe('por vencer');
    expect(plazoDeAviso(hace(49), null).estado).toBe('vencido');
    expect(plazoDeAviso(hace(49), hace(1)).estado).toBe('avisado');
  });
});

describe('alerta de vulneraciones sin aviso', () => {
  it('avisa a Dirección cuando el plazo está por vencer', async () => {
    const { job, notificaciones } = trabajo([{ id: 'v-1', descripcion: 'Correo enviado al local equivocado', detectedAt: hace(30) }]);
    expect(await job.vulneracionAlerts('org-1')).toBe(1);
    expect(notificaciones.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'dir-1', type: 'security.incident_notice_due' }));
  });

  it('avisa como vencida cuando pasaron las 48 horas', async () => {
    const { job, notificaciones } = trabajo([{ id: 'v-1', descripcion: 'Acceso indebido', detectedAt: hace(60) }]);
    await job.vulneracionAlerts('org-1');
    expect(notificaciones.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'security.incident_notice_overdue' }));
  });

  it('no avisa cuando todavía hay holgura', async () => {
    const { job, notificaciones } = trabajo([{ id: 'v-1', descripcion: 'Reciente', detectedAt: hace(2) }]);
    expect(await job.vulneracionAlerts('org-1')).toBe(0);
    expect(notificaciones.create).not.toHaveBeenCalled();
  });
});
