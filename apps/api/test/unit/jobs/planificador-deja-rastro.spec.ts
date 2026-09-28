import { describe, expect, it, vi } from 'vitest';
import { JobSchedulerService } from '../../../src/core/jobs/job-scheduler.service';

/*
 * El planificador interno anota cada corrida, igual que el cron de cPanel.
 *
 * La pantalla de Correos decide si un aviso «sale» mirando cuándo corrió su tarea, y sólo el cron
 * de cPanel lo anotaba. Con el planificador interno haciendo el trabajo, los correos se enviaban
 * y la pantalla igual los marcaba como «encendidos que no salen».
 */
function planificador(guardar = vi.fn().mockResolvedValue(undefined)) {
  const servicio = Object.create(JobSchedulerService.prototype) as unknown as {
    schedule: (nombre: string, intervalo: number, tarea: () => Promise<unknown>, alArrancar?: boolean) => void;
    running: Set<string>;
    timers: NodeJS.Timeout[];
    corridas: { save: typeof guardar };
    logger: { error: () => void; warn: () => void };
  };
  servicio.running = new Set();
  servicio.timers = [];
  servicio.corridas = { save: guardar };
  servicio.logger = { error: vi.fn(), warn: vi.fn() };
  return { servicio, guardar };
}

const esperar = () => new Promise((resolver) => setImmediate(resolver));

describe('planificador interno', () => {
  it('anota la corrida con el mismo nombre de tarea que usa la pantalla', async () => {
    const { servicio, guardar } = planificador();
    servicio.schedule('recordatorio-reservas', 3_600_000, async () => undefined, true);
    await esperar();

    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ task: 'recordatorio-reservas', ok: true }));
    servicio.timers.forEach(clearInterval);
  });

  it('una tarea que falla queda anotada como fallida', async () => {
    const { servicio, guardar } = planificador();
    servicio.schedule('cumpleanos', 3_600_000, async () => { throw new Error('sin correo'); }, true);
    await esperar();

    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ task: 'cumpleanos', ok: false, detail: 'sin correo' }));
    servicio.timers.forEach(clearInterval);
  });

  it('si no se puede anotar, la tarea no falla por eso', async () => {
    const { servicio } = planificador(vi.fn().mockRejectedValue(new Error('base caída')));
    const tarea = vi.fn().mockResolvedValue(undefined);
    servicio.schedule('resumen-diario', 3_600_000, tarea, true);
    await esperar();

    expect(tarea).toHaveBeenCalled();
    expect(servicio.running.has('resumen-diario')).toBe(false);
    servicio.timers.forEach(clearInterval);
  });
});
