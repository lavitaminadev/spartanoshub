import { describe, expect, it, vi } from 'vitest';
import { OperationalAlertsJob } from '../../../src/core/jobs/cron/operational-alerts.job';

/*
 * Lo prestado que está por vencer avisa a quien lo concedió, una sola vez, para que renueve o deje caer.
 */
function trabajo(consultas: (sql: string) => unknown[]) {
  const dataSource = { query: vi.fn(async (sql: string) => consultas(sql)) };
  const notificaciones = { create: vi.fn((v: unknown) => v), save: vi.fn(async (v: unknown) => v) };
  const job = new OperationalAlertsJob(dataSource as never, notificaciones as never, { get: vi.fn() } as never);
  return { job: job as unknown as { prestamosPorVencer(org: string): Promise<number> }, dataSource, notificaciones };
}

const VENCE = new Date(Date.now() + 2 * 86_400_000);

describe('aviso de préstamos por vencer', () => {
  it('avisa a quien concedió la cuenta prestada y deja marcado que ya se avisó', async () => {
    const { job, dataSource, notificaciones } = trabajo((sql) => {
      if (sql.includes('FROM user_client_access')) return [{ id: 'a-1', grantedBy: 'dir-1', expiresAt: VENCE, persona: 'Ana', empresa: 'Casa' }];
      if (sql.includes('FROM user_action_overrides')) return [];
      if (sql.includes('is_active = 1') && !sql.includes('role IN')) return [{ id: 'dir-1' }];
      if (sql.includes('SELECT id FROM notifications')) return [];
      return [];
    });

    const creadas = await job.prestamosPorVencer('org-1');

    expect(creadas).toBe(1);
    expect(notificaciones.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'dir-1', type: 'acceso.por_vencer' }));
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE user_client_access SET expiry_notified_at'), ['a-1']);
  });

  it('si quien lo concedió ya no está activo, avisa a la dirección', async () => {
    const { job, notificaciones } = trabajo((sql) => {
      if (sql.includes('FROM user_action_overrides')) return [{ id: 'x-1', grantedBy: 'se-fue', expiresAt: VENCE, persona: 'Ana', accion: 'crm.importar' }];
      if (sql.includes('role IN')) return [{ id: 'dir-9' }];
      if (sql.includes('is_active = 1')) return [{ id: 'dir-9' }];
      return [];
    });

    await job.prestamosPorVencer('org-1');

    expect(notificaciones.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'dir-9', type: 'accion.por_vencer' }));
  });

  it('sin nada por vencer no crea avisos', async () => {
    const { job, notificaciones } = trabajo(() => []);
    await expect(job.prestamosPorVencer('org-1')).resolves.toBe(0);
    expect(notificaciones.save).not.toHaveBeenCalled();
  });
});
